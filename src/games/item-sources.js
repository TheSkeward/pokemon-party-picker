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
 *   - a counted kind, which adds `count` copies at that badge: 'single'
 *     (one-per-save copies: an item ball, a hidden item, a gift) and
 *     'mining' (the copies the mining rocks reached by that badge yield on
 *     average; a rock is dug once, so they do not restock);
 *   - a renewable kind, which restocks without limit: 'shop' (shops, prize
 *     counters, exchanges), 'wild' (held by a catchable wild Pokémon),
 *     'pickup' (the Pickup ability), 'regrow' (planted berries, finds that
 *     come back), 'gift' (a gift that repeats);
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
 * Infinity once the supply is full (a source restocks the item, or
 * FULL_SUPPLY copies are counted), and null where the source is unaudited
 * and the count unknown.
 * @typedef {{badge: number, copies: ?number, source: !ItemSource}}
 */
let SupplyStep;

/** @const {!Set<string>} The kinds that restock an item without limit. */
export const RENEWABLE_SOURCE_KINDS = new Set([
  'shop',
  'wild',
  'pickup',
  'regrow',
  'gift',
]);

/**
 * The copies that equip a whole team. Past it a count stops mattering, as
 * it does once a source restocks the item.
 * @const {number}
 */
export const FULL_SUPPLY = 6;

/**
 * @param {!Array<!ItemSource>} sources
 * @return {!Array<!ItemSource>} A copy, earliest badge first and a
 *     renewable source ahead of a counted one at the same badge.
 */
export function orderItemSources(sources) {
  const rank = (source) => (RENEWABLE_SOURCE_KINDS.has(source.kind) ? 0 : 1);
  return [...sources].sort((a, b) =>
    a.badge - b.badge || rank(a) - rank(b));
}

/**
 * How a held item's supply grows: the counted copies in turn, until a
 * source restocks it or FULL_SUPPLY of them are had, past which copies stop
 * mattering. How the item is spent (games/item-use.js) decides what a
 * counted copy is worth: nothing for a consumable, whose supply starts at
 * the restocking source, and a full supply for a shared item.
 * @param {!Array<!ItemSource>} sources The item's sources, in
 *     orderItemSources order.
 * @param {{consumable: (boolean|undefined),
 *     shared: (boolean|undefined)}=} use
 * @return {!Array<!SupplyStep>} In badge order, copies that turn up at one
 *     badge as one step under the first of their sources; empty when no
 *     source counts.
 */
export function itemSupply(
  sources, { consumable = false, shared = false } = {},
) {
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
      const full = shared || copies >= FULL_SUPPLY;
      const last = steps.at(-1);
      if (last?.badge === source.badge && last.copies != null) {
        last.copies = full ? Infinity : copies;
      } else {
        steps.push({
          badge: source.badge, copies: full ? Infinity : copies, source,
        });
      }
      if (full) break;
    }
  }
  return steps;
}

// How a source of each kind reads in a sentence about where an item comes
// from. `when` holds the badge it opens at, worded for a moment (`at`)
// and for a start (`from`); `via` is the item data's words for it.
const SOURCE_PHRASES = {
  single: (via, when) => `a copy ${when.at}${via ? ` (${via})` : ''}`,
  mining: (via, when) => `mined ${when.from}`,
  shop: (via, when) => `sold ${when.from}${via ? ` (${via})` : ''}`,
  wild: (via, when) => `held by wild ${via || 'Pokémon'}, ${when.from}`,
  pickup: (via, when) => `found by ${via || 'Pickup'}, ${when.from}`,
  gift: (via, when) => `given ${when.from}${via ? ` (${via})` : ''}`,
};

function sourcePhrase({ kind, via }, badge) {
  const when = badge === 0
    ? { at: 'at the start', from: 'from the start' }
    : { at: `at badge ${badge}`, from: `from badge ${badge}` };
  const phrase = SOURCE_PHRASES[kind];
  // A kind with no wording of its own goes by the item data's.
  return phrase ? phrase(via, when) : [via, when.from].filter(Boolean).join(', ');
}

/**
 * A supply in words, for a sentence about where an item comes from: the
 * first source of each kind with the badge it opens at, and the badge the
 * counted copies fill the supply by where no phrase names that step.
 * @param {!Array<!SupplyStep>} supply
 * @return {string} '' for an empty supply.
 */
export function describeSupply(supply) {
  const kinds = new Set();
  const phrases = [];
  let named = null;
  for (const step of supply) {
    if (kinds.has(step.source.kind)) continue;
    kinds.add(step.source.kind);
    phrases.push(sourcePhrase(step.source, step.badge));
    named = step;
  }
  const last = supply.at(-1);
  if (last && last !== named && last.copies === Infinity) {
    phrases.push(`${FULL_SUPPLY} copies by badge ${last.badge}`);
  }
  return phrases.join('; ');
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
