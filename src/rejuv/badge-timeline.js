/**
 * @fileoverview The Rejuvenation progression timeline, in the shape
 * games/schedule.js reads (see reborn/badge-timeline.js for the field
 * conventions). Eighteen badge checkpoints: the fifteen of BIGJRA's
 * walkthrough (bigjra.github.io/rejuvenation, V13.5 chapters 1 to 15, in the
 * order the story awards them) and V14's three, which the walkthrough does
 * not yet cover and which follow the Aevium League's own listing.
 *
 * Level caps are the game's: LEVELCAPS in Scripts/Rejuv/SystemConstants.rb
 * (V14.0) is indexed by badge count, 18 before the first badge and 100 from
 * the seventeenth, and the game enforces it (a hard cap, not an honor
 * system). Pyramid Point and Sigil Pearl raise no cap; the sixteenth badge
 * does not either.
 *
 * `unlocks` names what first becomes obtainable at a checkpoint, timed by
 * the walkthrough chapter in which it is first reached: the evolution
 * access gates (rejuv/evolution-access in games/rejuv.js), the relearner,
 * and the headline held items. Timing is "the badge held when that chapter
 * begins", so a pickup late in a chapter may be a badge earlier than it
 * really is; nothing here claims a pickup before it exists.
 *
 * Notes against the walkthrough:
 *   - The Glacier Badge is handed over by Kreiss in Kristiline Town after
 *     the Angie arc; there is no gym fight at the award itself.
 *   - The Trickery Badge follows the Magenta & Neon puppet double battle.
 *   - Rose Badge: the player fights Flora or Florin; either path awards the
 *     same badge and cap.
 *   - The Fate Badge (a chapter-15 story battle reward) is not a gym badge:
 *     it changes neither the count nor the cap.
 *   - The Day Care's timing is not curated; tick it in the progression
 *     controls when you reach it.
 */

/** The timeline, in play order: game start then 18 badge checkpoints. */
export const REJUV_PROGRESSION_CHECKPOINTS = [
  {
    id: 'start', badges: 0, label: 'No badges', detail: 'Game start', levelCap: 18,
    // Luck's Tent opens in East Gearen; Alolan Marowak evolves anywhere in
    // the Goldenwood Forest region, on the road to the first badge.
    unlocks: { access: ['evoAccessGoldenwood'] },
  },
  {
    id: 'badge-1', badges: 1, label: 'PoisonHeart Badge (Venam)', levelCap: 25,
    // Route 2's Kecleon Bazaar sells the Link Heart and five stones (at
    // 25,000 each); Sheridan Village is a Hisuian Lilligant spot.
    unlocks: {
      access: [
        'evoAccessLinkHeart', 'evoAccessWaterStone', 'evoAccessDuskStone',
        'evoAccessDawnStone', 'evoAccessShinyStone', 'evoAccessIceStone',
        'evoAccessHisuianSpots',
      ],
    },
  },
  {
    id: 'badge-2', badges: 2, label: 'Diamond Punch Badge (Keta)', levelCap: 30,
    unlocks: { items: ['protectivepads'] }, // Chrysalis Manor
  },
  {
    id: 'badge-3', badges: 3, label: 'Normality Badge (Marianette)', levelCap: 35,
    // Route 3 and Goldenleaf: the Wispy Park tutor, hidden Moon and Sun
    // Stones, Wispy Ruins for Runerigus, the Route 3 stand's Sachet and
    // Whipped Dream.
    unlocks: {
      access: ['evoAccessMoonStone', 'evoAccessSunStone', 'evoAccessOtherLocations'],
    },
  },
  {
    id: 'badge-4', badges: 4, label: 'Phantasm Badge (Narcissa)', levelCap: 40,
    // Terajuma Island: the Kakori Beach tutor, Lost Camp's cheap Fire,
    // Water, and Leaf Stones, Alolan Exeggutor's island.
    unlocks: {
      access: ['evoAccessFireStone', 'evoAccessLeafStone', 'evoAccessTerajuma'],
    },
  },
  {
    id: 'badge-5', badges: 5, label: 'Dewdrop Badge (Valarie)', levelCap: 45,
    // Chapter 6: the Sheridan Move Relearner, the Akuwa tutors, Great
    // Terajuma Falls (Moss Rock), Evergreen Cave (Ice Rock), Route 11 and
    // Evergreen Island (the cold-climate evolutions), Reaper Cloth, and the
    // 50-cell Zygarde rewards.
    unlocks: {
      flags: ['moveRelearnerUnlocked'],
      access: ['evoAccessMossyRock', 'evoAccessIcyRock', 'evoAccessColdSpots'],
      items: ['weaknesspolicy', 'luckyegg'],
    },
  },
  {
    id: 'badge-6', badges: 6, label: 'Infested Badge (Crawli)', levelCap: 50,
    unlocks: {}, // Teila Resort's apple vendor (Sweet and Tart Apple)
  },
  {
    id: 'badge-7', badges: 7, label: 'Glacier Badge (Kreiss, after Angie)', levelCap: 55,
    // Chapter 8: Kristiline's RM shop, the Terajuma Excavation Site
    // (magnetic field), Razor Claw, Prism Scale, the 75-cell Safety Goggles.
    unlocks: {
      access: ['evoAccessMagneticField'],
      items: ['safetygoggles', 'razorclaw'],
    },
  },
  {
    id: 'badge-8', badges: 8, label: 'Lyric Badge (Amber)', levelCap: 60,
    // Chapter 9: West Gearen City (Galarian Weezing), the Electirizer and
    // Magmarizer quest.
    unlocks: { access: ['evoAccessWestGearen'] },
  },
  {
    id: 'badge-9', badges: 9, label: 'Pulse Badge (Erick)', levelCap: 65,
    unlocks: {}, // Oblitus Town's ultimate-move tutor; Protector
  },
  {
    id: 'badge-10', badges: 10, label: 'Rose Badge (Flora or Florin)', levelCap: 70,
    unlocks: { items: ['mirrorherb'] }, // Grand Dream City, Festival Plaza tutors
  },
  {
    id: 'badge-11', badges: 11, label: 'Trickery Badge (Magenta & Neon)', levelCap: 75,
    unlocks: {}, // the Omni Ring: Z-Crystals usable; Dubious Disc
  },
  {
    id: 'badge-12', badges: 12, label: 'Golden Wing Badge (Souta)', levelCap: 80,
    unlocks: {}, // Neo East Gearen tutors; Kristiline's 12-badge stock
  },
  {
    id: 'badge-13', badges: 13, label: 'Rugged Badge (Adam)', levelCap: 85,
    unlocks: {}, // the Kingdom of Goomidra's tutors
  },
  { id: 'badge-14', badges: 14, label: 'Pyramid Point Badge (Ryland)', levelCap: 85, unlocks: {} },
  {
    id: 'badge-15', badges: 15, label: 'Forgery Badge (Saki)', levelCap: 90,
    unlocks: { access: ['evoAccessThunderStone'] }, // the chapter-15 stone vendor
  },
  // V14: the league's last three seats, beyond the walkthrough's coverage.
  { id: 'badge-16', badges: 16, label: 'Sigil Pearl Badge (Damien)', levelCap: 90, unlocks: {} },
  { id: 'badge-17', badges: 17, label: 'Fairy Tale: Beginnings Badge (Allen)', levelCap: 100, unlocks: {} },
  { id: 'badge-18', badges: 18, label: 'Fairy Tale: Endings Badge (Alice)', levelCap: 100, unlocks: {} },
];
