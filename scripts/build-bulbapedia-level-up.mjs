/**
 * @fileoverview Builds a game's level-up learnsets from Bulbapedia's
 * per-generation learnset pages, for games whose levels differ from the
 * generation's other games. {@code @pkmn/dex} keeps one level-up list per
 * generation (Gen 4's carries Diamond, Pearl, and Platinum's levels), while
 * HeartGold and SoulSilver moved some moves: Cyndaquil's Smokescreen is
 * level 4 there and level 6 here. Bulbapedia's "Generation IV learnset"
 * pages list both, one column per game group, so this reads the column the
 * game belongs to.
 *
 *   node scripts/build-bulbapedia-level-up.mjs <gen> <column> <out.json>
 *       [--only=id,id,...]
 *
 * `column` is the game label to read (HGSS); a column whose label contains
 * it wins, a single-column table applies to every game of the generation.
 * Pages are cached under cache/bulbapedia/ so re-runs are free. Output:
 * {speciesId: {moveId: [levels]}} for every standard species of the
 * generation, forms included where the page has a section for them (a form
 * without one inherits its base species' list at build time).
 */

import fs from 'node:fs';
import path from 'node:path';
import { Dex } from '@pkmn/dex';

const ROMAN = { 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII' };
const CACHE_DIR = path.resolve('cache', 'bulbapedia');
const USER_AGENT = 'pokemon-party-picker/1.0 (learnset build)';

// Bulbapedia move spellings whose ids differ from the dex's.
const MOVE_ALIASES = {
  faintattack: 'feintattack',
  hijumpkick: 'highjumpkick',
  smellingsalt: 'smellingsalts',
  vicegrip: 'visegrip',
};

// Form section headers on a species' learnset page, by species.
const FORM_SECTIONS = {
  wormadam: { 'Plant Cloak': 'wormadam', 'Sandy Cloak': 'wormadamsandy', 'Trash Cloak': 'wormadamtrash' },
  deoxys: { 'Normal Forme': 'deoxys', 'Attack Forme': 'deoxysattack', 'Defense Forme': 'deoxysdefense', 'Speed Forme': 'deoxysspeed' },
  giratina: { 'Altered Forme': 'giratina', 'Origin Forme': 'giratinaorigin' },
  shaymin: { 'Land Forme': 'shaymin', 'Sky Forme': 'shayminsky' },
  rotom: { 'Normal Rotom': 'rotom', 'Heat Rotom': 'rotomheat', 'Wash Rotom': 'rotomwash', 'Frost Rotom': 'rotomfrost', 'Fan Rotom': 'rotomfan', 'Mow Rotom': 'rotommow' },
};

const toId = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

function parseArgs() {
  const [gen, column, out, ...rest] = process.argv.slice(2);
  if (!ROMAN[gen] || !column || !out) {
    throw new Error(
      'usage: build-bulbapedia-level-up.mjs <gen> <column> <out.json> [--only=ids]',
    );
  }
  const only = rest.find((arg) => arg.startsWith('--only='));
  return {
    gen: Number(gen),
    column,
    out,
    only: only ? new Set(only.slice('--only='.length).split(',')) : null,
  };
}

function pageTitle(species) {
  // The dex spells Farfetch'd with a typographic apostrophe; Bulbapedia's
  // title uses the plain one.
  const name = species.name
    .replace('Nidoran-F', 'Nidoran♀')
    .replace('Nidoran-M', 'Nidoran♂')
    .replace('’', "'");
  return `${name} (Pokémon)/Generation ${ROMAN[species.gen <= 4 ? 4 : species.gen]} learnset`;
}

// Cached by species id: titles differ only by ♀/♂ for the Nidoran pair.
async function fetchWikitext(title, gen, id) {
  const file = path.join(CACHE_DIR, `gen${gen}`, `${id}.json`);
  if (!fs.existsSync(file)) {
    const url =
      'https://bulbapedia.bulbagarden.net/w/api.php?action=parse&prop=wikitext&format=json&redirects=1&page=' +
      encodeURIComponent(title.replace(/ /g, '_'));
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) throw new Error(`${response.status} for ${title}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, await response.text());
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  return json.parse?.wikitext?.['*'] ?? null;
}

// The "By leveling up" section, split into (form header, rows) blocks.
function levelUpBlocks(wikitext) {
  const lines = wikitext.split('\n');
  // Older pages link [[level|...]], newer ones [[Level|...]].
  const start = lines.findIndex((line) =>
    /^====By \[\[level\|leveling up\]\]====/i.test(line));
  if (start < 0) return [];
  const blocks = [];
  let current = { form: null, header: null, rows: [] };
  for (const line of lines.slice(start + 1)) {
    if (/^====[^=]/.test(line)) break;
    const form = line.match(/^=====([^=]+)=====/);
    if (form) {
      if (current.header) blocks.push(current);
      current = { form: form[1].trim(), header: null, rows: [] };
      continue;
    }
    // A few pages capitalize the template name.
    const lower = line.toLowerCase();
    if (lower.startsWith('{{learnlist/levelh')) current.header = line;
    else if (
      lower.startsWith('{{learnlist/level') &&
      !lower.startsWith('{{learnlist/levelf')
    ) {
      current.rows.push(line);
    }
  }
  if (current.header) blocks.push(current);
  return blocks;
}

// Which level parameter holds this game's level, from the header's game
// labels: {{learnlist/levelh/4|Name|Type|Type|N|DPPt|HGSS}}. Pages of the
// older form {{learnlist/levelh|Name|type|type|gen|N}} have one column.
function columnIndex(header, column) {
  const params = header.replace(/^\{\{|\}\}$/g, '').split('|');
  if (params[0].toLowerCase() === 'learnlist/levelh') {
    return { index: 0, count: 1 };
  }
  const labels = params.slice(5);
  if (!labels.length) return { index: 0, count: 1 };
  const index = labels.findIndex((label) => label.includes(column));
  if (index < 0) throw new Error(`no ${column} column in ${header}`);
  return { index, count: labels.length };
}

function parseRows(rows, { index, count }, dex, unknown) {
  const learnset = {};
  for (const row of rows) {
    const params = row.replace(/^\{\{|\}\}$/g, '').split('|').slice(1);
    const levelText = params[index];
    const moveName = params[count];
    const level = Number.parseInt(String(levelText).replace(/<[^>]+>/g, ''), 10);
    if (!Number.isFinite(level) || !moveName) continue;
    let moveId = toId(moveName);
    moveId = MOVE_ALIASES[moveId] || moveId;
    if (!dex.moves.get(moveId)?.exists) {
      unknown.add(moveName);
      continue;
    }
    (learnset[moveId] ||= []).push(level);
  }
  for (const levels of Object.values(learnset)) levels.sort((a, b) => a - b);
  return learnset;
}

async function main() {
  const { gen, column, out, only } = parseArgs();
  const dex = Dex.forGen(gen);
  const species = dex.species
    .all()
    .filter((s) => s.exists && s.gen <= gen && !s.isNonstandard)
    .filter((s) => s.baseSpecies === s.name)
    .filter((s) => !only || only.has(s.id));

  const table = {};
  const unknown = new Set();
  const missing = [];
  for (const base of species) {
    const wikitext = await fetchWikitext(pageTitle(base), gen, base.id);
    const blocks = wikitext ? levelUpBlocks(wikitext) : [];
    if (!blocks.length) {
      missing.push(base.id);
      continue;
    }
    const forms = FORM_SECTIONS[base.id] || {};
    for (const block of blocks) {
      const id = block.form ? forms[block.form] : base.id;
      if (!id) continue;
      const columns = columnIndex(block.header, column);
      table[id] = parseRows(block.rows, columns, dex, unknown);
    }
    if (!table[base.id]) table[base.id] = parseRows(
      blocks[0].rows, columnIndex(blocks[0].header, column), dex, unknown);
  }

  const sorted = Object.fromEntries(
    Object.keys(table).sort().map((id) => [id, table[id]]));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(sorted, null, 1)}\n`);
  console.log(`[bulbapedia-level-up] ${Object.keys(sorted).length} learnsets for ${column} written to ${out}`);
  if (missing.length) console.log(`  missing pages: ${missing.join(', ')}`);
  if (unknown.size) console.log(`  unknown moves: ${[...unknown].join(', ')}`);
}

await main();
