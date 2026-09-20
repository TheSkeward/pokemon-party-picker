/**
 * @fileoverview The HGSS progression timeline, in the shape
 * games/schedule.js reads (see reborn/badge-timeline.js for the field
 * conventions). Sixteen badge checkpoints: the eight Johto gyms in the order
 * the game funnels the player through them, then the eight Kanto gyms in the
 * order Bulbapedia's HeartGold/SoulSilver walkthrough visits them (Kanto is
 * open-ended; the order matters only for which pickups a checkpoint expects).
 *
 * Level caps are the game's obedience thresholds (Bulbapedia, "Obedience"):
 * Lv. 10 with no badges, then 20 at Zephyr, 30 at Hive, 50 at Fog, 70 at
 * Storm or Mineral, and every level at Rising. Plain and Glacier raise no
 * threshold, nor does any Kanto badge. In Generation IV the thresholds bind
 * only outsider (traded) Pokémon, so for a self-caught team they mark the
 * pace of a playthrough rather than a hard limit.
 *
 * `unlocks` names what first becomes obtainable at a checkpoint: the Route 34
 * Day Care once Ilex Forest opens, the Blackthorn move relearner on arrival,
 * and the headline competitive items (the full item timeline is
 * hgss/items.js; the badges here agree with it).
 */

/** @type {!Array<!Object>} */
export const HGSS_PROGRESSION_CHECKPOINTS = [
  { id: 'start', badges: 0, label: 'No badges', detail: 'Game start', levelCap: 10, unlocks: {} },
  {
    id: 'badge-1', badges: 1, label: 'Zephyr Badge (Falkner)', levelCap: 20,
    unlocks: { items: ['lifeorb'] }, // Ruins of Alph, behind the Flash puzzle
  },
  {
    id: 'badge-2', badges: 2, label: 'Hive Badge (Bugsy)', levelCap: 30,
    unlocks: {
      flags: ['daycareUnlocked'], // Route 34 Day Care
      items: ['quickclaw', 'powerherb'], // National Park, Route 34
    },
  },
  { id: 'badge-3', badges: 3, label: 'Plain Badge (Whitney)', levelCap: 30, unlocks: {} },
  { id: 'badge-4', badges: 4, label: 'Fog Badge (Morty)', levelCap: 50, unlocks: {} },
  { id: 'badge-5', badges: 5, label: 'Storm Badge (Chuck)', levelCap: 70, unlocks: {} },
  {
    id: 'badge-6', badges: 6, label: 'Mineral Badge (Jasmine)', levelCap: 70,
    unlocks: { items: ['choicespecs'] }, // Lake of Rage
  },
  {
    id: 'badge-7', badges: 7, label: 'Glacier Badge (Pryce)', levelCap: 70,
    unlocks: { flags: ['moveRelearnerUnlocked'] }, // Blackthorn City
  },
  {
    id: 'badge-8', badges: 8, label: 'Rising Badge (Clair)', levelCap: 100,
    // The Battle Frontier's BP counter, priced for a finished Johto team.
    unlocks: { items: ['choiceband', 'choicescarf', 'focussash'] },
  },
  { id: 'badge-9', badges: 9, label: 'Thunder Badge (Lt. Surge)', levelCap: 100, unlocks: {} },
  { id: 'badge-10', badges: 10, label: 'Marsh Badge (Sabrina)', levelCap: 100, unlocks: {} },
  {
    id: 'badge-11', badges: 11, label: 'Cascade Badge (Misty)', levelCap: 100,
    unlocks: { items: ['leftovers'] }, // the Route 11 Snorlax
  },
  { id: 'badge-12', badges: 12, label: 'Rainbow Badge (Erika)', levelCap: 100, unlocks: {} },
  { id: 'badge-13', badges: 13, label: 'Soul Badge (Janine)', levelCap: 100, unlocks: {} },
  { id: 'badge-14', badges: 14, label: 'Boulder Badge (Brock)', levelCap: 100, unlocks: {} },
  { id: 'badge-15', badges: 15, label: 'Volcano Badge (Blaine)', levelCap: 100, unlocks: {} },
  {
    id: 'badge-16', badges: 16, label: 'Earth Badge (Blue)', levelCap: 100,
    unlocks: { items: ['expertbelt'] }, // Mt. Silver Cave
  },
];
