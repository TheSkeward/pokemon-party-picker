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
  { id: 'gen5ubers', label: 'Gen 5 Ubers', family: 'gen5singles' },
  { id: 'gen5ou', label: 'Gen 5 OU', family: 'gen5singles' },
  { id: 'gen5uu', label: 'Gen 5 UU', family: 'gen5singles' },
  { id: 'gen5ru', label: 'Gen 5 RU', family: 'gen5singles' },
  { id: 'gen5nu', label: 'Gen 5 NU', family: 'gen5singles' },
  { id: 'gen5pu', label: 'Gen 5 PU', family: 'gen5singles' },
  { id: 'gen5lc', label: 'Gen 5 LC', family: 'gen5singles' },
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
