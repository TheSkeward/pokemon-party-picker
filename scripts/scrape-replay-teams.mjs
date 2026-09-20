/**
 * @fileoverview Incremental Showdown replay harvester: for every format the
 * app tracks (scripts/config.mjs REAL_FORMATS — singles AND doubles), page
 * through the public replay search and append each new replay's team
 * compositions to a committed JSONL archive. The archive is the accumulating
 * dataset the derived indexes (core-index) are built from; raw fetches are
 * not kept.
 *
 * Every replay is kept, but the per-run budget goes to the valuable ones
 * first, in the order the weight ladder (teamscrape/weights.mjs) prices
 * them: smogtours games (tournament play; the id's server prefix names it,
 * and the search cannot filter on it), then ladder games rated 1630 and
 * up, then everything else. Per format and run, with durable cursors in
 * replays-crawl-state.json:
 *   1. tours: the newest pages, read until one holds nothing unseen, give
 *      up their smogtours and strong games first; then a scan-ahead cursor
 *      pages on back through history for the same, reading pages rather
 *      than replays, so it moves far faster than the backfill;
 *   2. elite: the search sorted by rating, page by page, taking games rated
 *      1630 and up until a page dips below that, then resting a month
 *      before looking at the top again for newcomers;
 *   3. fresh: the rest of those newest pages;
 *   4. rest: the backfill through history from where it left off, with
 *      whatever budget remains.
 *
 * Politeness contract: one request at a time, REQUEST_GAP_MS between
 * requests, identifying User-Agent, and a per-run cap on new replays per
 * format so a scheduled run is bounded. Runs where network policy allows
 * (CI / user machines); a blocked or failing format logs and moves on.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REAL_FORMATS } from './config.mjs';
import { parseReplayTeams, toTeamSheetId } from './teamscrape/replay-log.mjs';
import { parseBudget } from './teamscrape/listing-walk.mjs';
import { RATING_FLOORS, isTournamentReplay } from './teamscrape/weights.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
/** Directory holding the committed JSONL archives. @type {string} */
export const ARCHIVE_DIR = path.join(scriptDir, 'teamscrape', 'archive');
const STATE_FILE = path.join(ARCHIVE_DIR, 'replays-crawl-state.json');

const REPLAY_ROOT = 'https://replay.pokemonshowdown.com';
const USER_AGENT =
  'pokemon-party-picker team harvester (github.com/TheSkeward/pokemon-party-picker)';
const REQUEST_GAP_MS = 600;
// search.json returns up to 51; fewer means the end
const SEARCH_PAGE_SIZE = 51;
const DEFAULT_MAX_NEW_PER_FORMAT = 600;
/** The elite pass rests this long once it has walked below the floor. */
const ELITE_REST_MS = 30 * 24 * 60 * 60 * 1000;
/** Pages the scan-ahead pass reads per format per run. */
const DEFAULT_SCAN_PAGES_PER_RUN = 100;
/** Newest pages read per format per run before the backfill takes over. */
const DEFAULT_FRESH_PAGES_PER_RUN = 12;
/** Games rated here or above are worth reaching ahead of the backfill. */
const PRIORITY_RATING = RATING_FLOORS.strong;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url) {
  await sleep(REQUEST_GAP_MS);
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

/** @return {string} The replay archive file for a format. */
export function archivePath(formatId) {
  return path.join(ARCHIVE_DIR, `replays-${formatId}.jsonl`);
}

/**
 * @return {!Set<string>} Record ids already present in a JSONL archive file.
 */
export function readArchiveIds(file) {
  if (!fs.existsSync(file)) return new Set();
  const ids = new Set();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      ids.add(JSON.parse(line).id);
    } catch {
      // A torn line (interrupted append) loses one record, never the run.
    }
  }
  return ids;
}

/**
 * @param {!Object} replay Raw replay JSON (with battle log).
 * @return {{id: string, format: string, uploadtime: ?number, rating: ?number,
 *     teams: !Array<!Array<string>>}} The archive record: both sides'
 *     team-sheet species ids, deduped and sorted.
 */
export function normalizeReplay(replay, formatId) {
  const teams = parseReplayTeams(replay.log).map((side) =>
    [...new Set(side.map(toTeamSheetId))].sort(),
  );
  return {
    id: replay.id,
    format: formatId,
    uploadtime: replay.uploadtime ?? null,
    rating: replay.rating ?? null,
    teams,
  };
}

/**
 * Whether a search entry is worth fetching ahead of the backfill: a
 * smogtours game, or a ladder game at the strong band or above.
 * @param {{id: string, rating: ?number}} entry
 * @return {boolean}
 */
export function isPriorityEntry(entry) {
  return isTournamentReplay(entry) ||
    (Number(entry.rating) || 0) >= PRIORITY_RATING;
}

/** Smogtours ahead of strong ladder games, else the given order. */
function byPriority(a, b) {
  return Number(isTournamentReplay(b)) - Number(isTournamentReplay(a));
}

/** @return {!Object} Per-format pass cursors; empty when none saved. */
export function readCrawlState(file = STATE_FILE) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function saveCrawlState(state, file = STATE_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
}

/**
 * Harvests one format within its budget, the passes in priority order.
 * Injectable for tests: `fetchJson`, the archive `file`, the format's crawl
 * `cursor` (mutated), and `now`.
 * @return {!Promise<{appended: number, total: number,
 *     passes: {tours: number, elite: number, fresh: number, rest: number}}>}
 */
export async function harvestFormat(formatId, {
  maxNew,
  scanPages = DEFAULT_SCAN_PAGES_PER_RUN,
  freshPages = DEFAULT_FRESH_PAGES_PER_RUN,
  fetchJson: fetchImpl = fetchJson,
  file = archivePath(formatId),
  cursor = {},
  now = new Date(),
}) {
  const seen = readArchiveIds(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const passes = { tours: 0, elite: 0, fresh: 0, rest: 0 };
  let appended = 0;
  const search = (query) =>
    fetchImpl(`${REPLAY_ROOT}/search.json?format=${formatId}${query}`);
  const take = async (entry, pass) => {
    if (seen.has(entry.id)) return;
    let replay;
    try {
      replay = await fetchImpl(`${REPLAY_ROOT}/${entry.id}.json`);
    } catch (error) {
      console.warn(`  skip ${entry.id}: ${error.message}`);
      return;
    }
    const record = normalizeReplay(replay, formatId);
    if (!record.teams.every((team) => team.length)) return;
    fs.appendFileSync(file, `${JSON.stringify(record)}\n`);
    seen.add(entry.id);
    appended += 1;
    passes[pass] += 1;
  };

  // The newest pages, down to the first that holds nothing unseen: what
  // arrived since the last run. Buffered so the two passes over it cost
  // one read.
  const fresh = [];
  let before = null;
  for (let pages = 0; pages < freshPages; pages++) {
    const entries = await search(before ? `&before=${before}` : '');
    if (!Array.isArray(entries) || !entries.length) break;
    const unseen = entries.filter((entry) => !seen.has(entry.id));
    fresh.push(...unseen);
    before = entries[entries.length - 1].uploadtime ?? before;
    if (!unseen.length || entries.length < SEARCH_PAGE_SIZE) break;
  }
  // The backfill starts where the first fresh read ended and only ever
  // moves deeper; the fresh read covers everything above it from then on.
  if (cursor.restBefore == null && before != null) cursor.restBefore = before;

  // 1. Tours: the fresh region's priority games, then the scan-ahead.
  for (const entry of fresh.filter(isPriorityEntry).sort(byPriority)) {
    if (appended >= maxNew) break;
    await take(entry, 'tours');
  }
  let scanned = 0;
  while (appended < maxNew && scanned < scanPages && !cursor.scanDone) {
    const query = cursor.scanBefore ? `&before=${cursor.scanBefore}` : '';
    const entries = await search(query);
    scanned += 1;
    if (!Array.isArray(entries) || !entries.length) {
      cursor.scanDone = true;
      break;
    }
    for (const entry of entries.filter(isPriorityEntry).sort(byPriority)) {
      if (appended >= maxNew) break;
      await take(entry, 'tours');
    }
    cursor.scanBefore =
      entries[entries.length - 1].uploadtime ?? cursor.scanBefore;
    if (entries.length < SEARCH_PAGE_SIZE) cursor.scanDone = true;
  }

  // 2. Elite: rating-sorted pages until one dips below the floor.
  const rested = cursor.eliteRestedAt &&
    now.getTime() - Date.parse(cursor.eliteRestedAt) < ELITE_REST_MS;
  if (!rested) {
    if (cursor.eliteRestedAt) {
      delete cursor.eliteRestedAt;
      cursor.elitePage = 1;
    }
    let page = Math.max(1, Number(cursor.elitePage) || 1);
    while (appended < maxNew) {
      const entries = await search(`&sort=rating&page=${page}`);
      if (!Array.isArray(entries) || !entries.length) {
        cursor.eliteRestedAt = now.toISOString();
        break;
      }
      const eligible = entries.filter(
        (entry) => (Number(entry.rating) || 0) >= PRIORITY_RATING);
      for (const entry of eligible) {
        if (appended >= maxNew) break;
        await take(entry, 'elite');
      }
      if (appended >= maxNew) break;
      if (eligible.length < entries.length ||
          entries.length < SEARCH_PAGE_SIZE) {
        cursor.eliteRestedAt = now.toISOString();
        break;
      }
      page += 1;
      cursor.elitePage = page;
    }
  }

  // 3. Fresh: the rest of what arrived since the last run.
  for (const entry of fresh) {
    if (appended >= maxNew) break;
    await take(entry, 'fresh');
  }

  // 4. Rest: the backfill through history, resuming where it stopped.
  while (appended < maxNew && !cursor.restDone) {
    const entries = await search(`&before=${cursor.restBefore}`);
    if (!Array.isArray(entries) || !entries.length) {
      cursor.restDone = true;
      break;
    }
    for (const entry of entries) {
      if (appended >= maxNew) break;
      await take(entry, 'rest');
    }
    if (appended >= maxNew) break;
    cursor.restBefore =
      entries[entries.length - 1].uploadtime ?? cursor.restBefore;
    if (entries.length < SEARCH_PAGE_SIZE) cursor.restDone = true;
  }
  return { appended, total: seen.size, passes };
}

async function main() {
  const maxNew =
    parseBudget(process.argv, 'max-new', DEFAULT_MAX_NEW_PER_FORMAT);
  const scanPages =
    parseBudget(process.argv, 'scan-pages', DEFAULT_SCAN_PAGES_PER_RUN);
  // --format=<id> harvests one format, for a single-source question.
  const only = process.argv
    .find((arg) => arg.startsWith('--format='))?.slice('--format='.length);
  const formats = REAL_FORMATS.filter(({ id }) => !only || id === only);
  const state = readCrawlState();
  let failures = 0;
  for (const { id } of formats) {
    state[id] ||= {};
    try {
      const { appended, total, passes } =
        await harvestFormat(id, { maxNew, scanPages, cursor: state[id] });
      console.log(
        `${id}: +${appended} (archive ${total}; tours ${passes.tours}, ` +
          `elite ${passes.elite}, fresh ${passes.fresh}, rest ${passes.rest})`,
      );
    } catch (error) {
      failures += 1;
      console.warn(`${id}: harvest failed — ${error.message}`);
    } finally {
      saveCrawlState(state);
    }
  }
  // All-formats failure means no network (policy denial), not empty ladders.
  if (formats.length && failures === formats.length) {
    console.error('every format failed — is this environment allowed to reach replay.pokemonshowdown.com?');
    process.exitCode = 1;
  }
}

if (process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
