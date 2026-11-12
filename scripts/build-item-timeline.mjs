/**
 * @fileoverview Generates src/generated/rebornItemTimeline.generated.js:
 * every held item's sources in Pokémon Reborn, each with its kind and the
 * badge count it opens at (src/games/item-sources.js). The sources come
 * from:
 *
 *  1. site-data/data/reborn-item-availability.extracted.json — extracted from
 *     the community "Pokemon Reborn Ep19 Items & Services Guide" spreadsheet
 *     (All Items Locations + Shops + Arcade Lottery tabs), with the sheet's
 *     fight order mapped to badge counts (Corey/Kiki/Saphira award no badge;
 *     post-game tiers collapse to badge 18). Its `items` map keeps each
 *     item's earliest row, a single copy unless the row is the shop or the
 *     mining rocks; its `shopItems` map is the renewable shop stock.
 *  2. The same file's Mining Items tab: everything minable restocks from the
 *     Mining Kit on (Grand Stairway hiker, badge 3 — right after Shelly).
 *  3. WILD_HELD below (user-curated): an item a wild Pokémon carries
 *     restocks from the badge its holder is catchable. Only entries with a
 *     confidently-known holder timing are listed; corrections are one-line
 *     edits.
 *
 * Rerun: node scripts/build-item-timeline.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';

const MINING_KIT_BADGE = 3;

// item id -> { badge, holder } — the earliest confidently-known wild holder
// (e.g. Grimer is catchable immediately, so Black Sludge restocks pre-Julia).
const WILD_HELD = {
  blacksludge: { badge: 0, holder: 'Grimer (Opal/Peridot, immediate)' },
  metronome: { badge: 0, holder: 'Kricketot (Lower Peridot, immediate)' },
  smokeball: { badge: 1, holder: 'Koffing (early wards)' },
  widelens: { badge: 1, holder: 'Sableye (Obsidia Slums)' },
  kingsrock: { badge: 1, holder: 'Poliwag line (early rain puddles)' },
  brightpowder: { badge: 2, holder: 'Wurmple line (Rhodochrine Jungle)' },
  shedshell: { badge: 2, holder: 'Beautifly/Dustox (Wurmple line)' },
  powerherb: { badge: 2, holder: 'Seedot line (Rhodochrine Jungle)' },
  absorbbulb: { badge: 2, holder: 'Oddish (early alleys)' },
  mentalherb: { badge: 2, holder: 'Lotad (rainy Lapis)' },
};

// item id -> badge — user-verified SHOP stock kept as a cross-check overlay
// on the sheet's shopItems map (earliest badge wins). These should always
// agree with the sheet; a disagreement (warned below) is a signal one of the
// two is wrong. Badge 1: the Obsidia Department Store berry floor, verified
// in game.
const SHOP_STOCK = {
  oranberry: 1,
  cheriberry: 1,
  pechaberry: 1,
  rawstberry: 1,
  chestoberry: 1,
  aspearberry: 1,
};

// The sheet's source labels for a row that is the shop or the mining rocks
// themselves, which the renewable sources below already carry.
const SHOP_LABEL = 'Shop';
const MINING_LABEL = 'Mining Rock';

const toId = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const extracted = JSON.parse(
  readFileSync('site-data/data/reborn-item-availability.extracted.json', 'utf8'),
);
const { GEN7_HELD_ITEMS_BY_ID } = await import(
  '../src/generated/gen7HeldItems.generated.js',
);
const { REBORN_EXTRA_INVENTORY_ITEMS } = await import(
  '../src/reborn/extra-inventory-items.js',
);

const knownIds = new Set([
  ...Object.keys(GEN7_HELD_ITEMS_BY_ID),
  ...REBORN_EXTRA_INVENTORY_ITEMS.map((item) => item.id),
]);

// Shop stock (renewable: buy as many as needed once the shop is reachable),
// from the extraction's shopItems map — built from the Shops tab directly,
// so an item with an earlier one-off pickup keeps its shop row. An entry
// with `until` would be a stock window that permanently closes; the current
// sheet has none (every windowed mart row chains into a permanent seller),
// and a source has no closing badge to express one, so surface it loudly
// rather than silently promise expired stock forever.
const shopBadges = new Map();
for (const [name, entry] of Object.entries(extracted.shopItems)) {
  const id = toId(name);
  if (!knownIds.has(id)) continue;
  if (entry.until != null) {
    console.warn(
      `[item-timeline] WARNING: shop window for ${name} closes at badge ${entry.until}; expiry is unmodeled — item will read as purchasable forever`,
    );
  }
  const current = shopBadges.get(id);
  if (current == null || entry.badge < current) shopBadges.set(id, entry.badge);
}
for (const [id, badge] of Object.entries(SHOP_STOCK)) {
  if (!knownIds.has(id)) continue;
  const current = shopBadges.get(id);
  if (current == null) {
    console.warn(`[item-timeline] SHOP_STOCK ${id} missing from sheet shopItems`);
  } else if (current !== badge) {
    console.warn(`[item-timeline] SHOP_STOCK ${id} badge ${badge} disagrees with sheet ${current}`);
  }
  if (current == null || badge < current) shopBadges.set(id, badge);
}

const sources = new Map();
const add = (id, source) => {
  if (!knownIds.has(id)) return;
  sources.set(id, [...(sources.get(id) || []), source]);
};

// A shop row the shop stock does not carry is a one-time purchase.
for (const [name, entry] of Object.entries(extracted.items)) {
  const id = toId(name);
  if (entry.source === MINING_LABEL) continue;
  if (entry.source === SHOP_LABEL && shopBadges.get(id) <= entry.badges) {
    continue;
  }
  add(id, {
    kind: 'single',
    badge: entry.badges,
    count: 1,
    via: entry.source.toLowerCase(),
  });
}
for (const [id, badge] of shopBadges) {
  add(id, { kind: 'shop', badge, via: '' });
}
for (const name of extracted.miningItems) {
  add(toId(name), { kind: 'mining', badge: MINING_KIT_BADGE, via: '' });
}
for (const [id, entry] of Object.entries(WILD_HELD)) {
  add(id, { kind: 'wild', badge: entry.badge, via: entry.holder });
}

const byBadge = (a, b) => a.badge - b.badge || a.kind.localeCompare(b.kind);
const lines = [...sources.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([id, list]) => {
    const entries = [...list].sort(byBadge).map((source) =>
      `    ${JSON.stringify(source)},`);
    return `  ${id}: [\n${entries.join('\n')}\n  ],`;
  });

writeFileSync(
  'src/generated/rebornItemTimeline.generated.js',
  `// AUTO-GENERATED by scripts/build-item-timeline.mjs — do not edit by hand.
// Every held item's sources in Pokemon Reborn, each with its kind and the
// badge count it opens at (src/games/item-sources.js). ${extracted.provenance}
// Mining restocks from the Mining Kit (badge ${MINING_KIT_BADGE}); a wild-held item
// (user-curated holders) restocks from the badge its holder is catchable.
export const REBORN_ITEM_SOURCES = {
${lines.join('\n')}
};
`,
);

const count = (kind) =>
  [...sources.values()].filter((list) =>
    list.some((source) => source.kind === kind)).length;
console.log(
  `[item-timeline] ${sources.size} held items sourced (of ${knownIds.size} known ids): ` +
  `${count('single')} with a single copy, ${count('shop')} in shops, ` +
  `${count('mining')} mined, ${count('wild')} wild-held`,
);
const unknown = Object.keys(extracted.items).filter(
  (name) => !knownIds.has(toId(name)),
).length;
console.log(`[item-timeline] ${unknown} sheet rows outside the held-item catalog (TMs, medicine, etc.) ignored`);
