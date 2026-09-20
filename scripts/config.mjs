/**
 * Usage-data families: each is one generation's ladder of formats, strongest
 * tier first. A game names the families it draws its prior from; the family
 * ids are data paths and saved-state keys, so the two Gen 7 families keep
 * their original un-namespaced ids.
 * @type {!Object<string, {label: string, gen: number,
 *     formatOrder: !Array<string>, cutoffPriority: !Array<number>,
 *     defaultBrowserFormat: string}>}
 */
export const FAMILY_CONFIGS = {
  singles: {
    label: 'Singles',
    gen: 7,
    formatOrder: [
      'gen7anythinggoes',
      'gen7ubers',
      'gen7ou',
      'gen7uu',
      'gen7ru',
      'gen7nu',
      'gen7pu',
      'gen7zu',
      'gen7nfe',
      'gen7lc',
    ],
    cutoffPriority: [1760, 1630, 1500, 0],
    defaultBrowserFormat: 'gen7anythinggoes',
  },
  doubles: {
    label: 'Doubles',
    gen: 7,
    formatOrder: [
      'gen7doublesubers',
      'gen7doublesou',
      'gen7doublesuu',
    ],
    cutoffPriority: [1825, 1760, 1695, 1630, 1500, 0],
    defaultBrowserFormat: 'gen7doublesou',
  },
  // Smogon publishes Gen 4 OU every month; the lower tiers appear in
  // scattered months only, so this ladder is far thinner than Gen 7's.
  gen4singles: {
    label: 'Gen 4 Singles',
    gen: 4,
    formatOrder: ['gen4ubers', 'gen4ou', 'gen4uu', 'gen4nu', 'gen4lc'],
    cutoffPriority: [1760, 1630, 1500, 0],
    defaultBrowserFormat: 'gen4ou',
  },
  // Old-generation doubles: Smogon's doubles OU ladder in the months it
  // ran, then the VGC formats of the generation's years as the thinner
  // fallback (a different ruleset, but doubles usage all the same).
  gen4doubles: {
    label: 'Gen 4 Doubles',
    gen: 4,
    formatOrder: ['gen4doublesou', 'gen4vgc2010', 'gen4vgc2009'],
    cutoffPriority: [1760, 1630, 1500, 0],
    defaultBrowserFormat: 'gen4doublesou',
  },
  // Gen 5 OU is likewise monthly; UU, RU, NU, PU, and LC are scattered.
  gen5singles: {
    label: 'Gen 5 Singles',
    gen: 5,
    formatOrder: [
      'gen5ubers',
      'gen5ou',
      'gen5uu',
      'gen5ru',
      'gen5nu',
      'gen5pu',
      'gen5lc',
    ],
    cutoffPriority: [1760, 1630, 1500, 0],
    defaultBrowserFormat: 'gen5ou',
  },
  gen5doubles: {
    label: 'Gen 5 Doubles',
    gen: 5,
    formatOrder: [
      'gen5doublesou',
      'gen5smogondoubles',
      'gen5gbudoubles',
      'gen5vgc2013',
      'gen5vgc2011',
    ],
    cutoffPriority: [1760, 1630, 1500, 0],
    defaultBrowserFormat: 'gen5doublesou',
  },
  // National Dex is the prior for a Gen 9 game that fields every species
  // with Megas and Z-Moves (Rejuvenation): its three tiers first, then the
  // Scarlet and Violet tiers below UU as the thinner fallback for species
  // National Dex play never reaches (a different ruleset, without Megas,
  // but the same species).
  gen9natdexsingles: {
    label: 'Gen 9 NatDex Singles',
    gen: 9,
    formatOrder: [
      'gen9nationaldexubers',
      'gen9nationaldex',
      'gen9nationaldexuu',
      'gen9ru',
      'gen9nu',
      'gen9pu',
      'gen9lc',
    ],
    cutoffPriority: [1760, 1630, 1500, 0],
    defaultBrowserFormat: 'gen9nationaldex',
  },
  gen9natdexdoubles: {
    label: 'Gen 9 NatDex Doubles',
    gen: 9,
    formatOrder: [
      'gen9nationaldexdoubles',
      'gen9doublesubers',
      'gen9doublesou',
      'gen9doublesuu',
    ],
    cutoffPriority: [1760, 1630, 1500, 0],
    defaultBrowserFormat: 'gen9nationaldexdoubles',
  },
};

/** @type {!Array<{id: string, label: string, family: string}>} */
export const REAL_FORMATS = [
  { id: 'gen7anythinggoes', label: 'Gen 7 AG', family: 'singles' },
  { id: 'gen7ubers', label: 'Gen 7 Ubers', family: 'singles' },
  { id: 'gen7ou', label: 'Gen 7 OU', family: 'singles' },
  { id: 'gen7uu', label: 'Gen 7 UU', family: 'singles' },
  { id: 'gen7ru', label: 'Gen 7 RU', family: 'singles' },
  { id: 'gen7nu', label: 'Gen 7 NU', family: 'singles' },
  { id: 'gen7pu', label: 'Gen 7 PU', family: 'singles' },
  { id: 'gen7zu', label: 'Gen 7 ZU', family: 'singles' },
  { id: 'gen7nfe', label: 'Gen 7 NFE', family: 'singles' },
  { id: 'gen7lc', label: 'Gen 7 LC', family: 'singles' },
  { id: 'gen7doublesubers', label: 'Gen 7 Doubles Ubers', family: 'doubles' },
  { id: 'gen7doublesou', label: 'Gen 7 DOU', family: 'doubles' },
  { id: 'gen7doublesuu', label: 'Gen 7 DUU', family: 'doubles' },
  { id: 'gen4ubers', label: 'Gen 4 Ubers', family: 'gen4singles' },
  { id: 'gen4ou', label: 'Gen 4 OU', family: 'gen4singles' },
  { id: 'gen4uu', label: 'Gen 4 UU', family: 'gen4singles' },
  { id: 'gen4nu', label: 'Gen 4 NU', family: 'gen4singles' },
  { id: 'gen4lc', label: 'Gen 4 LC', family: 'gen4singles' },
  { id: 'gen4doublesou', label: 'Gen 4 DOU', family: 'gen4doubles' },
  { id: 'gen4vgc2010', label: 'Gen 4 VGC 2010', family: 'gen4doubles' },
  { id: 'gen4vgc2009', label: 'Gen 4 VGC 2009', family: 'gen4doubles' },
  { id: 'gen5ubers', label: 'Gen 5 Ubers', family: 'gen5singles' },
  { id: 'gen5ou', label: 'Gen 5 OU', family: 'gen5singles' },
  { id: 'gen5uu', label: 'Gen 5 UU', family: 'gen5singles' },
  { id: 'gen5ru', label: 'Gen 5 RU', family: 'gen5singles' },
  { id: 'gen5nu', label: 'Gen 5 NU', family: 'gen5singles' },
  { id: 'gen5pu', label: 'Gen 5 PU', family: 'gen5singles' },
  { id: 'gen5lc', label: 'Gen 5 LC', family: 'gen5singles' },
  { id: 'gen5doublesou', label: 'Gen 5 DOU', family: 'gen5doubles' },
  { id: 'gen5smogondoubles', label: 'Gen 5 Smogon Doubles', family: 'gen5doubles' },
  { id: 'gen5gbudoubles', label: 'Gen 5 GBU Doubles', family: 'gen5doubles' },
  { id: 'gen5vgc2013', label: 'Gen 5 VGC 2013', family: 'gen5doubles' },
  { id: 'gen5vgc2011', label: 'Gen 5 VGC 2011', family: 'gen5doubles' },
  { id: 'gen9nationaldexubers', label: 'Gen 9 NatDex Ubers', family: 'gen9natdexsingles' },
  { id: 'gen9nationaldex', label: 'Gen 9 NatDex OU', family: 'gen9natdexsingles' },
  { id: 'gen9nationaldexuu', label: 'Gen 9 NatDex UU', family: 'gen9natdexsingles' },
  { id: 'gen9ru', label: 'Gen 9 RU', family: 'gen9natdexsingles' },
  { id: 'gen9nu', label: 'Gen 9 NU', family: 'gen9natdexsingles' },
  { id: 'gen9pu', label: 'Gen 9 PU', family: 'gen9natdexsingles' },
  { id: 'gen9lc', label: 'Gen 9 LC', family: 'gen9natdexsingles' },
  { id: 'gen9nationaldexdoubles', label: 'Gen 9 NatDex Doubles', family: 'gen9natdexdoubles' },
  { id: 'gen9doublesubers', label: 'Gen 9 Doubles Ubers', family: 'gen9natdexdoubles' },
  { id: 'gen9doublesou', label: 'Gen 9 DOU', family: 'gen9natdexdoubles' },
  { id: 'gen9doublesuu', label: 'Gen 9 DUU', family: 'gen9natdexdoubles' },
];

/** Singles format ids, strongest tier first. @type {!Array<string>} */
export const FORMAT_POWER_ORDER = FAMILY_CONFIGS.singles.formatOrder;
/** Union of every family's cutoff priorities. @type {!Array<number>} */
export const CUTOFF_PRIORITY = [
  ...new Set(
    Object.values(FAMILY_CONFIGS).flatMap((family) => family.cutoffPriority),
  ),
];

/**
 * @param {number} gen
 * @return {!Array<string>} The family ids of one generation.
 */
export function familiesOfGen(gen) {
  return Object.keys(FAMILY_CONFIGS).filter(
    (family) => FAMILY_CONFIGS[family].gen === gen,
  );
}

/**
 * Cutoff used for browser datasets: 0 is the unfiltered baseline. @type
 * {number}
 */
export const DEFAULT_RATING = 0;
/** @type {string} */
export const STATS_ROOT = 'https://www.smogon.com/stats';
