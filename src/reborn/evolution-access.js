/**
 * @fileoverview Reborn's evolution access gates: which SPECIAL evolution
 * methods the player can currently use (Reborn locks them behind story/area
 * unlocks — the magnetic field lives behind Shade's gym via the Yureyal key,
 * stones drip in over badges, the Link Stone is a mid-game purchase). Each
 * maps a requirement to a flat boolean progression field; an ABSENT field
 * means accessible (so old saved progressions and tests behave exactly as
 * before), an explicit `false` blocks the evolution — surfaced in
 * blockedEvolutions, never silent.
 *
 * Each elemental stone gets its own gate; the rest of the item-shaped
 * methods (Metal Coat, Razor Claw, ...) share one gate. Legacy saves with the
 * old blanket `evoAccessStones: false` still block all of these (see the
 * denied check in evolution-requirements.js and the migration in
 * progression.js). The keys are what saved progressions and the badge
 * timeline's `unlocks.access` entries name, so they are part of the game's
 * saved-state contract.
 */

/** @type {Array<{key: string, label: string, item: string}>} */
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

/**
 * All access gates, stones included, in the order the progression UI lists
 * them. `item` is set only on the per-stone entries.
 * @type {Array<{key: string, label: string, item: (string|undefined)}>}
 */
export const EVOLUTION_ACCESS_FIELDS = Object.freeze([
  { key: 'evoAccessFriendship', label: 'Friendship / affection evolutions' },
  ...EVOLUTION_STONE_FIELDS,
  { key: 'evoAccessOtherEvoItems', label: 'Other evolution items (Metal Coat, Razor Claw, …)' },
  { key: 'evoAccessLinkStone', label: 'Link Stone (trade evolutions)' },
  { key: 'evoAccessPartyCondition', label: 'Party-condition evolutions (Mantyke needs a Remoraid)' },
  { key: 'evoAccessMagneticField', label: 'Magnetic field area (Probopass, Magnezone, Vikavolt)' },
  { key: 'evoAccessMossyRock', label: 'Moss Rock (Leafeon)' },
  { key: 'evoAccessIcyRock', label: 'Ice Rock (Glaceon)' },
  { key: 'evoAccessOtherLocations', label: 'Other special locations (Crabominable)' },
  { key: 'evoAccessApophyll', label: 'Apophyll area (Alolan evolutions: Raichu-A, Exeggutor-A)' },
]);
