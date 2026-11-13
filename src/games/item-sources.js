/**
 * @fileoverview The shape a game lists a held item's sources in (the
 * descriptor's `items.sources`, read by games/items.js), the supply a list
 * of sources adds up to, and the builder for a game whose sources are not
 * typed yet.
 */

/**
 * One way a game hands out a held item. `badge` is the badge count the
 * source opens at and `via` the item data's words for it (a place, a
 * holder, a shop). `kind` is one of:
 *   - 'single': a one-per-save copy (an item ball, a hidden item, a gift),
 *     `count` of them at that badge;
 *   - a renewable kind, which restocks without limit: 'shop' (shops, prize
 *     counters, exchanges), 'wild' (held by a catchable wild Pokémon),
 *     'mining', 'pickup' (the Pickup ability), 'regrow' (planted berries,
 *     respawning finds), 'gift' (a gift that repeats);
 *   - 'unaudited': the first source of an item in a game whose sources are
 *     not typed yet. The item is obtainable from that badge; whether it
 *     restocks, and how many copies exist, is not recorded.
 * @typedef {{kind: string, badge: number, via: string,
 *     count: (number|undefined)}}
 */
let ItemSource;

/**
 * One step in a held item's supply: from `badge` on, the player can hold
 * `copies` of it, which `source` brought to that count. `copies` is
 * Infinity from the first source that restocks the item, and null where the
 * source is unaudited and the count unknown.
 * @typedef {{badge: number, copies: ?number, source: !ItemSource}}
 */
let SupplyStep;

/** @const {!Set<string>} The kinds that restock an item without limit. */
export const RENEWABLE_SOURCE_KINDS = new Set([
  'shop',
  'wild',
  'mining',
  'pickup',
  'regrow',
  'gift',
]);

/**
 * @param {!Array<!ItemSource>} sources
 * @return {!Array<!ItemSource>} A copy, earliest badge first and a
 *     renewable source ahead of a single copy at the same badge.
 */
export function orderItemSources(sources) {
  const rank = (source) => (RENEWABLE_SOURCE_KINDS.has(source.kind) ? 0 : 1);
  return [...sources].sort((a, b) =>
    a.badge - b.badge || rank(a) - rank(b));
}

/**
 * How a held item's supply grows: each one-per-save copy in turn, then the
 * first source that restocks it, past which copies stop mattering. A battle
 * uses a consumable up (games/consumables.js), so its single copies are not
 * counted and its supply starts at the restocking source.
 * @param {!Array<!ItemSource>} sources The item's sources, in
 *     orderItemSources order.
 * @param {boolean} consumable
 * @return {!Array<!SupplyStep>} In badge order, copies that turn up at one
 *     badge as one step under the first of their sources; empty when no
 *     source counts.
 */
export function itemSupply(sources, consumable) {
  const steps = [];
  let copies = 0;
  for (const source of sources) {
    if (RENEWABLE_SOURCE_KINDS.has(source.kind)) {
      steps.push({ badge: source.badge, copies: Infinity, source });
      break;
    }
    if (source.kind === 'unaudited') {
      steps.push({ badge: source.badge, copies: null, source });
    } else if (!consumable) {
      copies += source.count ?? 1;
      const last = steps.at(-1);
      if (last?.badge === source.badge && last.copies != null) {
        last.copies = copies;
      } else {
        steps.push({ badge: source.badge, copies, source });
      }
    }
  }
  return steps;
}

/**
 * Sources for a game that records only the badge each item is first
 * obtainable at and the badge a shop sells it from. A first source at the
 * shop's badge is the shop; an earlier one is 'unaudited'. A game leaves
 * this builder when its sources are audited into typed lists.
 * @param {!Object<string, {badge: number, via: string}>} firstBadges
 * @param {!Object<string, number>} shopBadges
 * @return {!Object<string, !Array<!ItemSource>>}
 */
export function unauditedItemSources(firstBadges, shopBadges) {
  const sources = {};
  for (const [id, { badge, via }] of Object.entries(firstBadges)) {
    sources[id] = [{ kind: 'unaudited', badge, via }];
  }
  for (const [id, badge] of Object.entries(shopBadges)) {
    const first = sources[id]?.[0];
    if (first && first.badge < badge) {
      sources[id].push({ kind: 'shop', badge, via: '' });
    } else {
      sources[id] = [{ kind: 'shop', badge, via: first?.via || '' }];
    }
  }
  return sources;
}
