/**
 * @fileoverview How Pokémon Reborn's map events are dated: which switches
 * and story variables mean a badge count has been reached
 * (essentials/event-sources.mjs reads an event's conditions through this).
 */

/**
 * The switches that mean a badge is held, by switch name, and the badge.
 * "Third Gym" and "Sixth Gym" may turn on as the gym is entered, so they
 * bound the badge before.
 * @const {!Object<string, number>}
 */
const BADGE_SWITCHES = {
  'First Badge': 1,
  'Second Badge': 2,
  'Third Gym': 2,
  'Third Gym Done': 3,
  'Fourth Gym Done': 4,
  'Fifth Badge': 5,
  'Sixth Gym': 5,
  'Seventh Badge': 7,
  'Eighth Badge': 8,
  'Ninth Badge': 9,
  'Tenth Badge': 10,
  '11th Badge': 11,
  '12th badge': 12,
  '13th Badge': 13,
  '14th Badge': 14,
  '15th badge': 15,
  '16th Badge': 16,
  '17th Badge': 17,
  '18th Badge': 18,
  '19th Badge': 18,
  '20th Badge': 18,
};

/**
 * The badge count from which a map that exists only under a switch can be
 * visited. The city is restored once Fly opens the way back, at badge 13;
 * the three rebuilding projects are funded after that, 14 at the earliest.
 * @const {!Object<string, number>}
 */
export const REBORN_MAP_SWITCH_BADGES = {
  'City Restore': 13,
  'Slums Rebuilt': 14,
  'Railnet Rebuilt': 14,
  'Azurine rebuilt': 14,
};

/**
 * Badges held as each episode's story variable starts counting. The
 * nineteen episodes are the eighteen badge fights plus Corey's (3) and
 * Kiki's (6), with Titania and Amaria sharing episode 17; the badge-award
 * events' own episode variables agree (badge 5 in E7, 7 in E9, 10 in E12,
 * 13 in E15, 14 in E16, 16 in E17, 18 in E19).
 * @const {!Array<number>} Indexed by episode number.
 */
const EPISODE_START_BADGES = [
  0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17,
];

/**
 * @param {string} name A switch name.
 * @return {?number} The badge a badge switch implies; null for any other
 *     switch.
 */
export function rebornBadgeSwitchBadge(name) {
  return BADGE_SWITCHES[name] ?? null;
}

/**
 * @const {!EventDating} An event's switch dates it when it is a badge
 *     switch or one a map exists under; a variable dates it when it is an
 *     episode's story variable, from that episode's first badge whatever
 *     the value asked for.
 */
export const REBORN_EVENT_DATING = {
  switchBadge: (name) =>
    rebornBadgeSwitchBadge(name) ?? REBORN_MAP_SWITCH_BADGES[name] ?? null,
  variableBadge: (name) => {
    const episode = /^E(\d+) Story/.exec(name);
    return episode ? EPISODE_START_BADGES[Number(episode[1])] ?? null : null;
  },
};
