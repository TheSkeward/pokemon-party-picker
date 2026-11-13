/**
 * @fileoverview Reborn's evolution access gates: which SPECIAL evolution
 * methods the player can currently use (Reborn locks them behind story/area
 * unlocks — the magnetic field lives behind Shade's gym via the Yureyal
 * key). Each maps a requirement to a flat boolean progression field; an
 * ABSENT field means accessible (so old saved progressions and tests behave
 * exactly as before), an explicit `false` blocks the evolution — surfaced
 * in blockedEvolutions, never silent.
 *
 * No field gates an evolution item (a stone, the Link Stone, a Metal Coat):
 * an evolution spends one from the held-item list, which can be set to the
 * counts Reborn's item sources expect at a badge
 * (playthrough/evolution-requirements.js). The keys are
 * what saved progressions and the badge timeline's `unlocks.access`
 * entries name, so they are part of the game's saved-state contract.
 */

/**
 * All access gates, in the order the progression UI lists them.
 * @type {Array<{key: string, label: string,
 *     defaultFromUnlock: (boolean|undefined)}>}
 */
export const EVOLUTION_ACCESS_FIELDS = Object.freeze([
  { key: 'evoAccessFriendship', label: 'Friendship / affection evolutions' },
  { key: 'evoAccessPartyCondition', label: 'Party-condition evolutions (Mantyke needs a Remoraid)' },
  { key: 'evoAccessMagneticField', label: 'Magnetic field area (Probopass, Magnezone, Vikavolt)' },
  { key: 'evoAccessMossyRock', label: 'Moss Rock (Leafeon)' },
  { key: 'evoAccessIcyRock', label: 'Ice Rock (Glaceon)' },
  { key: 'evoAccessOtherLocations', label: 'Other special locations (Crabominable)' },
  { key: 'evoAccessApophyll', label: 'Apophyll area (Alolan evolutions: Raichu-A, Exeggutor-A)' },
  // The Mega-Z Ring comes from DJ Arclight's sidequest after Titania, so
  // this gate follows the badge count by default: closed before badge 15,
  // open after, with the checkbox overriding either way (an early ring from
  // a password, or the badge without the quest).
  {
    key: 'evoAccessMegaRing',
    label: 'Mega Evolution (Mega-Z Ring, Arclight\'s quest after Titania)',
    defaultFromUnlock: true,
  },
]);
