/**
 * @fileoverview Tournament harvester: walks the configured tournament
 * forums/threads (team dumps and replay threads — SPL old-gen slots, RoA
 * cups). Two yields:
 *   pastes  → tournament-<format>.jsonl (whole sets, elite prepared play)
 *   replays → replays-<format>.jsonl with source:"tournament", so the core
 *             index prices them as tournament play instead of unrated.
 * Dump threads carry their teams as inline importables and as pokepaste
 * links, neither of which names a format (pokepaste keeps none), so the
 * format comes from the nearest evidence outward: a paste's own
 * "=== [gen7ou] ===" header, the generation label heading the section the
 * team sits in ("ADV", "DPP Ubers", "USM OU"), the post's replay links
 * when they all share one format, then the thread: a config pin
 * ({url, format} or {url, gen, tier}), its prefix label via rmt.prefixMap,
 * the generation and tier its title names. Replay links attribute by the
 * id's format segment. Listing rows whose title names a generation the
 * app does not track are marked complete unread.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  MIN_SETS_PER_TEAM,
  parseShowdownTeam,
} from './teamscrape/parse-showdown-team.mjs';
import { groupInlineTeams, normalizeSampleTeam } from
  './scrape-sample-teams.mjs';
import {
  appendJsonlRecord,
  createFormatArchives,
} from './teamscrape/jsonl-records.mjs';
import {
  archivePath,
  normalizeReplay,
  readArchiveIds,
} from './scrape-replay-teams.mjs';
import {
  extractPosts,
  extractThreadRows,
  hasNextPage,
  listingDebugInfo,
} from './teamscrape/forum-html.mjs';
import {
  findLabels,
  genFromLabel,
  tierFromTitle,
} from './teamscrape/tier-names.mjs';
import {
  forListing,
  importLegacyThreads,
  nextThreadPage,
  readCrawlState,
  recordDeferredThread,
  recordListingPage,
  recordSinglePageThread,
  recordThreadPage,
  saveCrawlState,
  shouldScanThread,
} from './teamscrape/crawl-state.mjs';
import {
  closeTeamSourceFetcher,
  fetchTeamSourceText as fetchText,
} from './teamscrape/forum-fetch.mjs';
import {
  parseBudget,
  walkListingPages,
} from './teamscrape/listing-walk.mjs';
import { REAL_FORMATS } from './config.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const ARCHIVE_DIR = path.join(scriptDir, 'teamscrape', 'archive');
const SOURCES_PATH = path.join(scriptDir, 'teamscrape', 'sources.json');

const DEFAULT_MAX_NEW = 200;
const DEFAULT_LISTING_PAGES_PER_RUN = 4;
const DEFAULT_THREAD_PAGES_PER_RUN = 40;

const knownFormats = new Set(REAL_FORMATS.map((f) => f.id));
const trackedGens = new Set(
  REAL_FORMATS.map((f) => Number(/^gen(\d)/.exec(f.id)[1])),
);
/**
 * replay.pokemonshowdown.com/<id> ids embed the format:
 * "gen7ou-967241" and "smogtours-gen7ou-406712" both attribute to gen7ou.
 *
 * @return {?string} The format id, or null when absent or not tracked.
 */
export function replayLinkFormat(replayId) {
  const match = replayId.match(/(?:^|-)((?:gen\d)[a-z0-9]+)-\d+$/);
  return match && knownFormats.has(match[1]) ? match[1] : null;
}

/** @return {!Array<string>} Unique replay ids linked in the HTML. */
export function extractReplayIds(html) {
  return [
    ...new Set(
      [...String(html).matchAll(
        /replay\.pokemonshowdown\.com\/([a-z0-9-]+-\d+)/g,
      )].map((match) => match[1]),
    ),
  ];
}

const archives = createFormatArchives(ARCHIVE_DIR, 'tournament-');

/** @return {?number} The generation of a format id. */
const genOf = (formatId) =>
  formatId ? Number(/^gen(\d)/.exec(formatId)?.[1]) || null : null;
/** @return {?string} The tier segment of a format id. */
const tierOf = (formatId) =>
  formatId ? /^gen\d(.+)$/.exec(formatId)?.[1] || null : null;

/**
 * What a thread says about every team in it: a config pin (`format`, or
 * `gen` and `tier` when the thread spans generations or tiers), else its
 * prefix label's format, else the generation and tier its title names.
 * @param {{title: string, prefixFormat: ?string, pin: !Object}} thread
 * @return {{format: ?string, gen: ?number, tier: ?string}}
 */
export function threadContext({ title, prefixFormat, pin }) {
  const format = pin.format || prefixFormat || null;
  return {
    format,
    gen: pin.gen ?? (format ? genOf(format) : genFromLabel(title)),
    tier: pin.tier ?? (format ? tierOf(format) : tierFromTitle(title)),
  };
}

/**
 * The format a team belongs to, from the nearest evidence outward: the
 * section label before it (its generation, and its tier when the label
 * names one), the post's replay links when they all share one format, the
 * thread's own context. A label naming only a generation ("ADV") takes the
 * tier from the thread, else from the post's replays.
 * @param {{
 *   label: ?{gen: ?number, tier: ?string},
 *   replayFormat: ?string,
 *   thread: {format: ?string, gen: ?number, tier: ?string},
 * }} evidence
 * @return {?string} A tracked format id, or null.
 */
export function attributeFormat({ label, replayFormat, thread }) {
  let candidate = null;
  if (label?.gen != null) {
    const tier = label.tier ?? thread.tier ?? tierOf(replayFormat);
    candidate = tier ? `gen${label.gen}${tier}` : null;
  } else if (replayFormat) {
    candidate = replayFormat;
  } else if (thread.format) {
    candidate = thread.format;
  } else if (thread.gen != null && thread.tier) {
    candidate = `gen${thread.gen}${thread.tier}`;
  }
  return candidate && knownFormats.has(candidate) ? candidate : null;
}

/** @return {?Object} The last label at or before an offset. */
function labelBefore(labels, index) {
  let last = null;
  for (const label of labels) {
    if (label.index > index) break;
    last = label;
  }
  return last;
}

/**
 * A post's inline importables as whole teams, sectioned by the generation
 * labels between them so a dump listing "ADV" then "DPP" teams never groups
 * across the heading. Each section parses on its own; a paste-style
 * "=== [gen7ou] ===" header inside it names the format outright.
 * @param {string} text The post's text.
 * @return {!Array<{label: ?Object, format: ?string, teams: !Array}>}
 */
export function sectionInlineTeams(text) {
  const source = String(text || '');
  const labels = findLabels(source);
  const bounds = [0, ...labels.map((label) => label.index), source.length];
  const sections = [];
  for (let i = 0; i + 1 < bounds.length; i++) {
    const parsed = parseShowdownTeam(source.slice(bounds[i], bounds[i + 1]));
    const teams = groupInlineTeams(parsed.sets);
    if (!teams.length) continue;
    sections.push({
      label: i === 0 ? null : labels[i - 1],
      format: parsed.format && knownFormats.has(parsed.format)
        ? parsed.format
        : null,
      teams,
    });
  }
  return sections;
}

async function harvestPost(post, { thread, threadUrl, threadId, postIndex,
  counters }) {
  const replayIds = extractReplayIds(post.html);
  const replayFormats = new Set(
    replayIds.map(replayLinkFormat).filter(Boolean),
  );
  const replayFormat = replayFormats.size === 1 ? [...replayFormats][0] : null;
  const evidence = (label) => ({ label, replayFormat, thread });

  // Linked pastes: pokepaste carries no format of its own, so the label
  // nearest before the link in the post decides.
  const htmlLabels = findLabels(post.html);
  const seenPastes = new Set();
  for (const match of post.html.matchAll(/pokepast\.es\/([0-9a-f]{8,16})/g)) {
    const pasteId = match[1];
    if (seenPastes.has(pasteId)) continue;
    seenPastes.add(pasteId);
    let parsed;
    try {
      parsed = parseShowdownTeam(await fetchText(`https://pokepast.es/${pasteId}/raw`));
    } catch {
      continue;
    }
    const formatId =
      (parsed.format && knownFormats.has(parsed.format) && parsed.format) ||
      attributeFormat(evidence(labelBefore(htmlLabels, match.index)));
    if (!formatId || parsed.sets.length < MIN_SETS_PER_TEAM) continue;
    const { file, latest } = archives.forFormat(formatId);
    const record = normalizeSampleTeam(
      { pasteId, formatId, thread: threadUrl, sets: parsed.sets });
    record.source = 'tournament';
    counters.teams += Number(appendJsonlRecord(file, record, latest));
  }

  // Inline importables, by section.
  sectionInlineTeams(post.text).forEach((section, sectionIndex) => {
    const formatId =
      section.format || attributeFormat(evidence(section.label));
    if (!formatId) return;
    const { file, latest } = archives.forFormat(formatId);
    section.teams.forEach((sets, group) => {
      const pasteId =
        `thread-${threadId}-post-${postIndex}-${sectionIndex}-${group}`;
      const record =
        normalizeSampleTeam({ pasteId, formatId, thread: threadUrl, sets });
      record.source = 'tournament';
      counters.teams += Number(appendJsonlRecord(file, record, latest));
    });
  });

  for (const replayId of replayIds) {
    const formatId = replayLinkFormat(replayId);
    if (!formatId) continue;
    const file = archivePath(formatId);
    const seen = counters.replaySeen.get(formatId) || readArchiveIds(file);
    counters.replaySeen.set(formatId, seen);
    if (seen.has(replayId)) continue;
    let replay;
    try {
      replay = await fetchText(
        `https://replay.pokemonshowdown.com/${replayId}.json`,
      ).then(JSON.parse);
    } catch {
      continue;
    }
    const record = normalizeReplay(replay, formatId);
    record.source = 'tournament';
    if (record.teams.every((team) => team.length)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, `${JSON.stringify(record)}\n`);
      seen.add(replayId);
      counters.replays += 1;
    }
  }
}

async function harvestThreadPage(html, page, context) {
  const posts = extractPosts(html);
  for (const [index, post] of posts.entries()) {
    await harvestPost(post, {
      ...context,
      // Stable across runs: XenForo pages hold a fixed number of posts.
      postIndex: `${page}-${index}`,
    });
  }
}

async function harvestThread({ row, prefixFormat, pin, counters, crawl,
  crawlFile, sweep, budget, maxThreadPages, maxNew }) {
  let page = nextThreadPage(crawl.threads[row.threadId]);
  while (budget.threadPages < maxThreadPages) {
    const html = await fetchText(
      page === 1 ? row.url : `${row.url}page-${page}`);
    budget.threadPages += 1;
    const title =
      row.title || (/<title>([^<]*)<\/title>/.exec(html)?.[1] || '').trim();
    await harvestThreadPage(html, page, {
      thread: threadContext({ title, prefixFormat, pin: pin || {} }),
      threadUrl: row.url,
      threadId: row.threadId,
      counters,
    });
    const next = hasNextPage(html, page);
    recordThreadPage(crawl, row, { page, hasNext: next, sweep });
    saveCrawlState(crawlFile, crawl);
    if (!next) return true;
    if (counters.teams + counters.replays >= maxNew) return false;
    page += 1;
  }
  return false;
}

async function main() {
  const config = JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf8'));
  const tournament = config.tournament || {};
  const prefixMap =
    { ...(config.rmt?.prefixMap || {}), ...(tournament.prefixMap || {}) };
  const maxNew = parseBudget(process.argv, 'max-new', DEFAULT_MAX_NEW);
  const listingPagesPerRun =
    parseBudget(process.argv, 'listing-pages', DEFAULT_LISTING_PAGES_PER_RUN);
  const maxThreadPages =
    parseBudget(process.argv, 'thread-pages', DEFAULT_THREAD_PAGES_PER_RUN);
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  const counters = { teams: 0, replays: 0, replaySeen: new Map() };
  const budget = { threadPages: 0 };
  const crawlFile = path.join(ARCHIVE_DIR, 'tournament-crawl-state.json');
  const crawl = readCrawlState(crawlFile);
  importLegacyThreads(
    crawl,
    path.join(ARCHIVE_DIR, 'tournament-threads.jsonl'),
  );
  saveCrawlState(crawlFile, crawl);

  // Standalone dump threads: a URL, or {url, format} / {url, gen, tier}
  // pinning what the thread's own text leaves unsaid — the whole thread is
  // harvested (replies ARE team dumps by other players, unlike RMT).
  for (const [index, entry] of (tournament.dumpThreads || []).entries()) {
    const pin = typeof entry === 'string' ? { url: entry } : entry;
    const { url } = pin;
    const row = {
      threadId: /\.(\d+)\/?$/.exec(url)?.[1] || `dump-${index}`,
      url,
      updatedAt: null,
    };
    const listingKey = `dump:${url}`;
    const progress = forListing(crawl, listingKey);
    try {
      const complete = await harvestThread({
        row,
        prefixFormat: null,
        pin,
        counters,
        crawl,
        crawlFile,
        sweep: progress.sweep,
        budget,
        maxThreadPages,
        maxNew,
      });
      if (complete) {
        recordListingPage(crawl, listingKey, progress.page, false);
        saveCrawlState(crawlFile, crawl);
      }
    } catch (error) {
      console.warn(`tournament dump ${url}: FAILED — ${error.message}`);
    }
  }

  // Forum listings: page 1 is always live discovery; the durable cursor walks
  // the remaining listing pages and every page of each discovered thread.
  for (const listing of tournament.listings || []) {
    try {
      const progress = forListing(crawl, listing);
      const processPage = async (html, page) => {
        const rows = extractThreadRows(html, listing);
        if (!rows.length) {
          if (page === 1) {
            console.log(
              `tournament listing ${listing}: 0 rows on page 1 ` +
                `(${listingDebugInfo(html)})`,
            );
          }
          return { handled: true, next: false };
        }
        let handled = true;
        for (const row of rows) {
          if (
            counters.teams + counters.replays >= maxNew ||
            budget.threadPages >= maxThreadPages
          ) {
            handled = false;
            break;
          }
          if (!shouldScanThread(
            crawl.threads[row.threadId], row, progress.sweep)) continue;
          // Ruins of Alph mixes every generation; a thread the title
          // places in one the app does not track holds nothing for it.
          const gen = genFromLabel(`${row.prefix || ''} ${row.title}`);
          if (gen != null && !trackedGens.has(gen)) {
            recordSinglePageThread(crawl, row, progress.sweep);
            saveCrawlState(crawlFile, crawl);
            continue;
          }
          const prefixFormat =
            row.prefix ? prefixMap[row.prefix] || null : null;
          try {
            const complete = await harvestThread({
              row,
              prefixFormat,
              pin: {},
              counters,
              crawl,
              crawlFile,
              sweep: progress.sweep,
              budget,
              maxThreadPages,
              maxNew,
            });
            if (!complete) handled = false;
          } catch (error) {
            console.warn(`  thread ${row.threadId}: ${error.message}`);
            // A per-thread 4xx (locked or deleted thread) never resolves;
            // defer it so the cursor advances. Anything else may be
            // transient and must block the cursor for a retry next run.
            if (error.status >= 400 && error.status < 500 &&
                error.status !== 429) {
              recordDeferredThread(crawl, row, progress.sweep);
              saveCrawlState(crawlFile, crawl);
            } else {
              handled = false;
            }
          }
        }
        return { handled, next: hasNextPage(html, page) };
      };

      await walkListingPages({
        listing,
        fetchText,
        processPage,
        crawl,
        crawlFile,
        listingPagesPerRun,
        outOfBudget: () =>
          counters.teams + counters.replays >= maxNew ||
          budget.threadPages >= maxThreadPages,
      });
    } catch (error) {
      console.warn(`tournament listing ${listing}: FAILED — ${error.message}`);
    }
  }
  console.log(
    `tournament: +${counters.teams} teams, +${counters.replays} replays`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const run = async () => {
    try {
      await main();
    } finally {
      await closeTeamSourceFetcher();
    }
  };
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
