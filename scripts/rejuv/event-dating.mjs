/**
 * @fileoverview How Pokémon Rejuvenation's map events are dated: which
 * switches and story variables mean a badge count has been reached
 * (essentials/event-sources.mjs reads an event's conditions through this).
 *
 * A badge count is the number of badges held. The game hands over its
 * sixteenth and seventeenth, Fairy Tale: Beginnings and Endings, on one
 * page (map 661 ev 142; map 366 ev 82, 110 and 119 on the Renegade route)
 * and Sigil Pearl last (map 637 ev 130; map 625 ev 68, 119 and 120), so
 * the count goes 15, 17, 18.
 *
 * The evidence is each event's own gate, read from the install (V14.0.0):
 * the page conditions of the event that first sets a variable, and the
 * value a badge's page leaves it at once the badge is handed over. That a
 * story variable only counts upward along the one main story is taken as
 * given: most of its steps are set by events that stand in the player's
 * way, with no gate to read.
 */

/**
 * The badge count held once a gym switch is on, by switch name. Each is
 * turned on by its badge's page, after the badge, but for these:
 *   - "Defeated Gym 1" is also turned on as Chapter 2 opens (common event
 *     61, called by map 304 ev 83 p4).
 *   - "Defeated Gym 2" is turned on when Keta is beaten (map 38 ev 16 p2,
 *     under 'V2 | Story' 29); his badge is handed over later, in the
 *     Amethyst Grotto (map 488 ev 4, 10 and 15 p3), so the switch bounds
 *     the badge before.
 *   - "Defeated Gym 4" is also turned on in Goldenleaf Town (map 82 ev 46
 *     to 48 p2) and the Wispy Ruins (map 489 ev 43), each under a switch
 *     turned on after the fourth badge: on its own page (map 400 ev 30)
 *     and under 'Story V4 ' 41 (map 82 ev 61).
 *   - "Defeated Gym 11" is also turned on on Route 7 (map 459 ev 12),
 *     where the page that hands the badge over sends the player (map 151
 *     ev 22 p2).
 *   - "Defeated Gym 13" is turned on under 'Post12thBadge' 129 (map 556
 *     ev 7 p3, map 548 ev 42) and in the dream that follows (map 348 ev
 *     10); its badge's own page turns "Defeated Gym 12" on once more.
 *   - "Defeated Gym 16" and "17" are turned on together, after both badges
 *     (map 661 ev 142).
 *   - "Defeated Gym 18" is turned on under 'v14 Story | PT3' 66 (map 637
 *     ev 130 p3).
 * @const {!Object<string, number>}
 */
const GYM_SWITCHES = {
  'Defeated Gym 1': 1,
  'Defeated Gym 2': 1,
  'Defeated Gym 3': 3,
  'Defeated Gym 4': 4,
  'Defeated Gym 5': 5,
  'Defeated Gym 6': 6,
  'Defeated Gym 7': 7,
  'Defeated Gym 8': 8,
  'Defeated Gym 9': 9,
  'Defeated Gym 10': 10,
  'Defeated Gym 11': 11,
  'Defeated Gym 12': 12,
  'Defeated Gym 13': 13,
  'Defeated Gym 14': 14,
  'Defeated Gym 15': 15,
  'Defeated Gym 16': 17,
  'Defeated Gym 17': 17,
  'Defeated Gym 18': 18,
};

/**
 * Maps that exist only under a switch, and the badge count from which
 * each can be visited: none, since maps.dat gives no map a switch.
 * @const {!Object<string, number>}
 */
export const REJUV_MAP_SWITCH_BADGES = {};

/**
 * The variables that count the main story, by name, each as [least value,
 * badges held] pairs in rising order: the count held once the variable has
 * reached that value. A first pair at 1 is the count held as the variable
 * starts counting, given where what first sets it is itself dated; a
 * variable without one is not dated below its first pair. A later pair is
 * a value set only once a badge is held: by the badge's page after it
 * hands the badge over (the higher value, where two pages hand over one
 * badge), or under the badge's gym switch.
 *
 * Left out, because nothing dates them: 'Story | CarotosSec',
 * 'Route4Story', 'Story | Battleship', 'V5 Story | Blacksteeple' and
 * 'v14RenegadePT1' are first set by an event with no gate, and no badge
 * is handed over under them. 'AngelicaGymStory' counts a tower in which
 * the game reports a badge count of its own (PokeBattle_Trainer#numbadges,
 * Scripts/Rejuv/BlackPrismHandlers.rb:12). The Xenpurgis variables count a
 * separate mode, and 'Melia' and its like a character's regard.
 * @const {!Object<string, !Array<!Array<number>>>}
 */
const STORY_VARIABLES = {
  // The prologue, on the map a new game starts on (map 136 ev 2).
  'Story V-1 | Prlg': [[1, 0]],
  // The voyage that follows; it ends as 'Story | V1' starts (map 21 ev 45).
  'Story | Prologue': [[1, 0]],
  // Set to 20 after the first badge (map 484 ev 10).
  'Story | V1': [[1, 0], [20, 1]],
  // Started on Route 1 with no gate (map 5 ev 46), so nothing dates it
  // past the game's start.
  'v1Story | SilentGrove': [[1, 0]],
  // Started under 'Story | V1' 26 (map 199 ev 2). Keta is beaten at 29,
  // but hands his badge over under 'Ael'.
  'V2 | Story': [[1, 1]],
  // Set to 5 after the second badge, under 4 (map 488 ev 4, 10, 15 p3).
  // What starts it, a switch of the Xen Lounge's first scene, is not dated.
  'Ael': [[5, 2]],
  // Started under 'Ael' 6 (map 425 ev 34 p5); set to 22 after the third
  // badge (map 389 ev 1).
  'Story | V3 Marianette': [[1, 2], [22, 3]],
  // Started under "Defeated Gym 3" (map 67 ev 23); set to 40 after the
  // fourth badge (map 400 ev 30).
  'Story V4 ': [[1, 3], [40, 4]],
  // Started in the Terajuma Jungle with no gate (map 210 ev 15 p1). Set
  // to 9 under "Defeated Gym 5" (the same event's p3), to 44 after the
  // sixth badge (map 410 ev 2) and to 145 after the seventh, under 144
  // (map 336 ev 50 and 95).
  'Vines | Terajuma': [[9, 5], [44, 6], [145, 7]],
  // Started under 'Vines | Terajuma' 145 (map 329 ev 77). The eighth
  // badge's page (map 414 ev 39) sets no story variable.
  'Post7thbadge': [[1, 7]],
  // First set, to 5, under 'Quest | LeavingTera' 4 (map 118 ev 1 and 25),
  // which is itself started under "Defeated Gym 8" (map 333 ev 40 p4).
  // Set to 53 under "Defeated Gym 9" (map 415 ev 17 p2).
  'Post8thBadge': [[1, 8], [53, 9]],
  // Started under "Defeated Gym 9" (map 421 ev 1 p2); set to 31 after the
  // tenth badge, under 30 (map 368 ev 12 p1 and p2).
  'Post9thBadge': [[1, 9], [31, 10]],
  // Started under 'Post9thBadge' 33 (map 342 ev 65). The eleventh badge
  // is handed over under 46 and the variable set to 47 (map 151 ev 22
  // p2), or under 47 and set to 48 (map 313 ev 103). System.rxdata gives
  // a second variable this name, 146, which nothing reads or sets.
  'Post10thBadge': [[1, 10], [48, 11]],
  // Started under 'Post10thBadge' 55 or more (map 285 ev 30 and 54); set
  // to 88 after the twelfth badge, under 86 (map 468 ev 2).
  'Post11thBadge': [[1, 11], [88, 12]],
  // Started under 'Post11thBadge' 106 (map 254 ev 51 and 53); set to 129
  // after the thirteenth badge, under 128 (map 554 ev 14 p12).
  'Post12thBadge': [[1, 12], [129, 13]],
  // The two ways through the chapter, each started under 'Post12thBadge'
  // 4 (map 257 ev 64).
  'Post12thSplit[1]': [[1, 12]],
  'Post12thSplit[2]': [[1, 12]],
  // Started under either split (map 517 ev 41 and 109; map 36 ev 26).
  'Lavender Story': [[1, 12]],
  // Started under 'Post12thBadge' 129 (map 556 ev 7 p3), which sends the
  // player to the stage of map 113 where the host counts it on (ev 61);
  // set to 119 after the fourteenth badge, under 118 (map 581 ev 55, 84
  // and 85).
  'Story v12 ': [[1, 13], [119, 14]],
  // Started under 'Story v12 ' 86 (map 460 ev 39).
  'Storyv12AteBit': [[1, 13]],
  // Started by the Xen Lounge's twelfth scene (map 34 ev 4 p12), which
  // the player is sent to under 'Story v12 ' 131 (map 313 ev 26 p15); set
  // to 125 before the fifteenth badge's fight and to 127 after the badge
  // (map 111 ev 100).
  'V13 Story': [[1, 14], [127, 15]],
  // Started under 'V13 Story' 46 (map 441 ev 54).
  'V13 PEARL ROUTE': [[1, 14]],
  // Started under 'V13 Story' 131 (map 441 ev 60 and 80 p3).
  'V13|.KarmaFiles': [[1, 15]],
  // Started by the Xen Lounge's thirteenth scene (map 34 ev 4 p13), which
  // needs 'TheLoungeStory' at 12; only the two ends of the Karma Files set
  // that (map 399 ev 8 p3, map 441 ev 61).
  'v14 Story | PT1': [[1, 15]],
  // Started under 'v14 Story | PT1' 136 (map 307 ev 18); set to 96 after
  // the sixteenth and seventeenth badges, under 95 (map 661 ev 142).
  'v14 Story | PT2': [[1, 15], [96, 17]],
  // Started by the event that sets 'v14 Story | PT2' to 111 (map 621 ev
  // 65); set to 66 after the eighteenth badge (map 637 ev 130 p1 and p2).
  'v14 Story | PT3': [[1, 17], [66, 18]],
  // Set to 55 before the fight for the sixteenth and seventeenth badges
  // and to 56 after them, under 54 (map 366 ev 82, 110 and 119).
  'v14RenegadePT2': [[56, 17]],
  // Started under 'v14RenegadePT2' 64 (map 579 ev 84); set to 51 after
  // the eighteenth badge, under 50 (map 625 ev 68 p5, ev 119 and 120 p3).
  'v14RenegadePT3': [[1, 17], [51, 18]],
};

/**
 * Variables that hold a value of the moment, not a point in the story: the
 * entry just picked from a menu, the outcome of the battle just fought, a
 * die an event rolls, the seed Route 4's items respawn by. A condition on
 * one gates nothing in time.
 * @const {!Set<string>}
 */
const MOMENTARY_VARIABLES = new Set([
  'Temp Pokemon Choice',
  'Battle Results',
  'Random [1]',
  'Random [2]',
  'Rt4Seed',
]);

/**
 * @const {!EventDating} An event's switch dates it when it is a gym
 *     switch. A variable dates it when it counts the main story, by the
 *     highest of its dated values at or under the value asked for; a value
 *     under all of them dates nothing, and a value any variable holds from
 *     the start, none above zero, dates to no badges. A variable of the
 *     moment dates to no badges whatever is asked of it.
 */
export const REJUV_EVENT_DATING = {
  switchBadge: (name) => GYM_SWITCHES[name] ?? null,
  variableBadge: (name, floor) => {
    if (MOMENTARY_VARIABLES.has(name)) return 0;
    const dated = STORY_VARIABLES[name];
    if (!dated) return null;
    if (floor <= 0) return 0;
    return dated.findLast(([value]) => value <= floor)?.[1] ?? null;
  },
};
