/**
 * @fileoverview How much grind each evolution item takes in Pokémon Reborn.
 *
 * A hand-set judgment per item: "farmable" (reliably obtainable) or
 * "farmable-tedious" (obtainable with real grind). An item not listed is
 * not judged, and counts as farmable.
 *
 * Whether the game hands an item out, and where, is not stated here.
 * games/items.js reads both off the item's sources, which are built from
 * the game files.
 */
/** @type {!Object<string, {status: string}>} */
export const REBORN_EVOLUTION_ITEM_AVAILABILITY = {
  ovalstone: { status: 'farmable' },
  metalcoat: { status: 'farmable-tedious' },
  kingsrock: { status: 'farmable-tedious' },
  razorclaw: { status: 'farmable-tedious' },
  razorfang: { status: 'farmable-tedious' },
  electirizer: { status: 'farmable-tedious' },
  magmarizer: { status: 'farmable-tedious' },
  dragonscale: { status: 'farmable-tedious' },
  deepseatooth: { status: 'farmable-tedious' },
  deepseascale: { status: 'farmable-tedious' },
  lightball: { status: 'farmable-tedious' },
  linkstone: { status: 'farmable-tedious' },
  firestone: { status: 'farmable-tedious' },
  waterstone: { status: 'farmable-tedious' },
  thunderstone: { status: 'farmable-tedious' },
  leafstone: { status: 'farmable-tedious' },
  moonstone: { status: 'farmable-tedious' },
  sunstone: { status: 'farmable-tedious' },
  shinystone: { status: 'farmable-tedious' },
  duskstone: { status: 'farmable-tedious' },
  dawnstone: { status: 'farmable-tedious' },
  icestone: { status: 'farmable-tedious' },
};
