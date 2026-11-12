/**
 * @fileoverview Derives Reborn's renewable item sources from its game-file
 * extracts (extract-reborn-item-sources.mjs): the items wild Pokémon hold,
 * the Pickup table, the point counters and planted berries. Pure: the
 * timeline builder feeds it the extracts and the timing, the tests feed it
 * fixtures.
 */

const toId = (text) =>
  String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// How an encounter type reads beside a place; the walking tables need no
// word.
const METHOD_WORDS = {
  Water: 'surfing',
  RockSmash: 'Rock Smash',
  OldRod: 'Old Rod',
  GoodRod: 'Good Rod',
  SuperRod: 'Super Rod',
  Headbutt: 'headbutt',
};

/**
 * The earliest wild holder of every item some wild Pokémon carries.
 * @param {{holdChances: !Object, itemNames: !Object<string, string>,
 *     species: !Object<string, !Object>}} wildItems The wild-items extract.
 * @param {{maps: !Array<!Object>}} encounters The encounters extract.
 * @param {function(!Object, string): ?number} badgeOf Given an encounter
 *     map and one of its encounter types, the badge count at which that
 *     table can be met; null when it is not dated, which drops the table.
 * @return {!Map<string, {badge: number, via: string}>} Item id -> the
 *     badge its first holder is catchable at, and the holder, its hold
 *     chance and the place. Among holders at one badge the likeliest hold
 *     wins, then the map and species order of the extracts.
 */
export function wildHeldSources(wildItems, encounters, badgeOf) {
  const chances = wildItems.holdChances.default;
  const best = new Map();
  for (const map of encounters.maps) {
    for (const [type, slots] of Object.entries(map.types)) {
      const badge = badgeOf(map, type);
      if (badge == null) continue;
      for (const species of new Set(slots.map((slot) => slot.species))) {
        for (const held of heldBy(wildItems, species, chances)) {
          const id = toId(wildItems.itemNames[held.item] || held.item);
          const current = best.get(id);
          if (
            current && (current.badge < badge ||
              (current.badge === badge && current.chance >= held.chance))
          ) {
            continue;
          }
          const method = METHOD_WORDS[type];
          best.set(id, {
            badge,
            chance: held.chance,
            via: `${held.name} (${held.chance}%), ${map.mapName}` +
              (method ? `, ${method}` : ''),
          });
        }
      }
    }
  }
  return new Map(
    [...best].map(([id, { badge, via }]) => [id, { badge, via }]));
}

// A species' wild held items with their hold chances. A wild Pokémon is its
// species' Normal Form unless a map says otherwise, which no table records.
function heldBy(wildItems, species, chances) {
  const form = wildItems.species[species]?.['Normal Form'];
  if (!form) return [];
  const slots = ['common', 'uncommon', 'rare'];
  const items = slots.map((slot) => form[slot]);
  // All three slots naming one item means it is always held.
  if (items[0] && items.every((item) => item === items[0])) {
    return [{ item: items[0], name: form.name, chance: 100 }];
  }
  const byItem = new Map();
  slots.forEach((slot, index) => {
    if (!items[index]) return;
    byItem.set(items[index], (byItem.get(items[index]) || 0) + chances[slot]);
  });
  return [...byItem].map(([item, chance]) =>
    ({ item, name: form.name, chance }));
}

/**
 * The badge from which each Pickup item can turn up.
 * @param {{itemNames: !Object<string, string>, table: !Array<{
 *     minLevel: number, slots: !Array<{item: string}>}>}} pickup The Pickup
 *     extract: per holder-level bracket, lowest first, the items it yields.
 * @param {!Array<{badges: number, levelCap: number}>} checkpoints The
 *     progression checkpoints, in play order.
 * @param {number} firstHolderBadge The badge count at which a Pokémon with
 *     Pickup is first catchable.
 * @return {!Map<string, {badge: number, via: string}>} Item id -> the first
 *     badge whose level cap admits a holder of the lowest bracket that
 *     yields the item.
 */
export function pickupSources(pickup, checkpoints, firstHolderBadge) {
  const sources = new Map();
  for (const bracket of pickup.table) {
    const reached = checkpoints.find((checkpoint) =>
      checkpoint.levelCap >= bracket.minLevel);
    if (!reached) continue;
    const badge = Math.max(reached.badges, firstHolderBadge);
    for (const { item } of bracket.slots) {
      const id = toId(pickup.itemNames[item] || item);
      if (sources.has(id)) continue;
      sources.set(id, {
        badge,
        via: `a Pickup holder at level ${bracket.minLevel} or above`,
      });
    }
  }
  return sources;
}

/**
 * The items a point counter trades without limit: an exchange the game
 * never closes, paid from a point variable and not in items.
 * @param {{itemNames: !Object<string, string>, events: !Array<!Object>}}
 *     itemEvents The item-events extract.
 * @param {number} mapId The counter's map.
 * @return {!Map<string, string>} Item id -> the counter's words: its map
 *     and the points it takes.
 */
export function pointCounterStock(itemEvents, mapId) {
  const stock = new Map();
  for (const event of itemEvents.events) {
    if (event.mapId !== mapId) continue;
    for (const give of event.gives) {
      const points = (give.costs || []).find((cost) => cost.variable != null);
      if (
        give.kind !== 'exchange' || give.repeat !== 'unlimited' ||
        !give.item || !points
      ) {
        continue;
      }
      const id = toId(itemEvents.itemNames[give.item] || give.item);
      stock.set(id, `${event.mapName}, ${points.name}s`);
    }
  }
  return stock;
}

/**
 * The berries a berry plot regrows: every plantable berry the player can
 * already have one of, from the later of the plots opening and that first
 * berry.
 * @param {{itemNames: !Object<string, string>, scriptRules: {berryPlants:
 *     {values: !Array<{berry: string}>}}}} itemEvents The item-events
 *     extract, whose berry rules list what the plant script grows.
 * @param {function(string): ?number} firstBadgeOf Item id -> the badge the
 *     berry is first obtainable at by any other source; null for a berry
 *     with none, which cannot be planted.
 * @param {number} plotBadge The badge count at which the first plots open.
 * @return {!Map<string, number>} Item id -> the badge it regrows from.
 */
export function plantedBerries(itemEvents, firstBadgeOf, plotBadge) {
  const berries = new Map();
  for (const { berry } of itemEvents.scriptRules.berryPlants.values) {
    const id = toId(itemEvents.itemNames[berry] || berry);
    const first = firstBadgeOf(id);
    if (first != null) berries.set(id, Math.max(plotBadge, first));
  }
  return berries;
}
