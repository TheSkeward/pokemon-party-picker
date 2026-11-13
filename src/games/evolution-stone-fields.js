/**
 * @fileoverview The access fields of the evolution stones, one per stone,
 * for a game whose progression gates its stones by hand. A game whose
 * evolutions spend the held-item list lists none (games/evolution.js).
 * The keys are what saved progressions and a badge timeline's
 * `unlocks.access` entries name, so they are part of a game's saved-state
 * contract.
 */

/** @type {!Array<{key: string, label: string, item: string}>} */
export const EVOLUTION_STONE_FIELDS = Object.freeze([
  { key: 'evoAccessFireStone', label: 'Fire Stone', item: 'Fire Stone' },
  { key: 'evoAccessWaterStone', label: 'Water Stone', item: 'Water Stone' },
  { key: 'evoAccessThunderStone', label: 'Thunder Stone', item: 'Thunder Stone' },
  { key: 'evoAccessLeafStone', label: 'Leaf Stone', item: 'Leaf Stone' },
  { key: 'evoAccessMoonStone', label: 'Moon Stone', item: 'Moon Stone' },
  { key: 'evoAccessSunStone', label: 'Sun Stone', item: 'Sun Stone' },
  { key: 'evoAccessShinyStone', label: 'Shiny Stone', item: 'Shiny Stone' },
  { key: 'evoAccessDuskStone', label: 'Dusk Stone', item: 'Dusk Stone' },
  { key: 'evoAccessDawnStone', label: 'Dawn Stone', item: 'Dawn Stone' },
  { key: 'evoAccessIceStone', label: 'Ice Stone', item: 'Ice Stone' },
]);
