/**
 * @fileoverview The Black 2 and White 2 progression timeline, in the shape
 * games/schedule.js reads (see reborn/badge-timeline.js for the field
 * conventions). Eight badge checkpoints in the order the game funnels the
 * player through the gyms, then the Champion, after which the rest of
 * Unova opens: western Unova (Nacrene, Striaton, Nuvema, the Route 3 Day
 * Care), Route 8 and beyond, Twist Mountain, and Black City / White Forest.
 *
 * Level caps are the game's obedience thresholds (Bulbapedia, "Obedience"):
 * Lv. 10 with no badges, then 20, 30, 40, 50, 60, 70, and 80 badge by
 * badge, and every level at Wave. In Generation V the thresholds bind only
 * outsider (traded) Pokémon, so for a self-caught team playing to them is
 * an honor system (the user's choice); the "No cap" option turns them off.
 *
 * `unlocks` names what first becomes obtainable at a checkpoint: the PWT's
 * Move Reminder once Driftveil opens, the Route 3 Day Care after the
 * Champion, and the headline competitive items (the full item timeline is
 * b2w2/items.js; the badges here agree with it).
 */

/** @type {!Array<!Object>} */
export const B2W2_PROGRESSION_CHECKPOINTS = [
  { id: 'start', badges: 0, label: 'No badges', detail: 'Game start', levelCap: 10, unlocks: {} },
  { id: 'badge-1', badges: 1, label: 'Basic Badge (Cheren)', levelCap: 20, unlocks: {} },
  {
    id: 'badge-2', badges: 2, label: 'Toxic Badge (Roxie)', levelCap: 30,
    unlocks: { items: ['leftovers', 'eviolite'] }, // Castelia Sewers, Castelia City
  },
  { id: 'badge-3', badges: 3, label: 'Insect Badge (Burgh)', levelCap: 40, unlocks: {} },
  {
    id: 'badge-4', badges: 4, label: 'Bolt Badge (Elesa)', levelCap: 50,
    unlocks: { items: ['airballoon'] }, // Driftveil City
  },
  {
    id: 'badge-5', badges: 5, label: 'Quake Badge (Clay)', levelCap: 60,
    unlocks: {
      flags: ['moveRelearnerUnlocked'], // Pokémon World Tournament
      items: ['rockyhelmet'], // Pokémon World Tournament
    },
  },
  { id: 'badge-6', badges: 6, label: 'Jet Badge (Skyla)', levelCap: 70, unlocks: {} },
  { id: 'badge-7', badges: 7, label: 'Legend Badge (Drayden)', levelCap: 80, unlocks: {} },
  { id: 'badge-8', badges: 8, label: 'Wave Badge (Marlon)', levelCap: 100, unlocks: {} },
  // Beating the Champion opens the rest of Unova; the cap does not move, but
  // the Day Care and every BP prize wait for it.
  {
    id: 'champion', badges: 8, postgame: 1, short: 'Champion',
    label: 'Champion (the rest of Unova opens)', levelCap: 100,
    unlocks: {
      flags: ['daycareUnlocked'], // Route 3
      items: ['lifeorb', 'choiceband', 'choicescarf', 'choicespecs', 'focussash'],
    },
  },
];
