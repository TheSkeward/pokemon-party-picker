/**
 * @fileoverview Usage families. A usage family names where a run reads its
 * competitive prior from. It is a family of the usage data (a tab:
 * "singles") or an extension of one, read in the family's place when the
 * run calls for it. A Fire monotype run reads "singles-monofire": the
 * Singles family, with the sets Fire teams ran on Smogon's Monotype ladder
 * in place of the Singles sets for the Pokémon those teams favoured.
 *
 * An extension's formats supply sets and nothing else. Every Pokémon is
 * ranked on the base family's ladder, and whatever has no source in the
 * extension's formats (the move and item tables, teammate lift, the team
 * corpora) is the base family's, as is the set of any Pokémon those formats
 * do not favour.
 *
 * The data pipeline (scripts/config.mjs) and the app both read this module,
 * so the ids and the ladders are defined once.
 */

// No family id contains it (test/usage-family.test.mjs), so an id splits
// without the config in hand.
const SEPARATOR = '-';

/**
 * @param {?string} family A usage family id.
 * @return {string} The family whose data backs it: the family it extends,
 *     or itself.
 */
export function baseFamilyOf(family) {
  const id = String(family || '');
  const cut = id.indexOf(SEPARATOR);
  return cut < 0 ? id : id.slice(0, cut);
}

/**
 * @param {?string} family A usage family id.
 * @return {boolean} Whether the id names an extension of a family.
 */
export function isFamilyExtension(family) {
  return String(family || '').includes(SEPARATOR);
}

/**
 * @param {string} family The family extended.
 * @param {string} type A type name ("Fire").
 * @return {string} The id of the family's monotype extension for the type.
 */
export function monotypeFamilyId(family, type) {
  return `${family}${SEPARATOR}mono${String(type).toLowerCase()}`;
}

/**
 * The usage family a run reads: the family's monotype extension when the
 * run has a monotype and the usage data holds that extension, else the
 * family itself (Doubles has no Monotype ladder to extend it with).
 * @param {?Object} availability The availability index.
 * @param {string} family The family the run is in.
 * @param {?string} monotype The run's type; '' for none.
 * @return {string}
 */
export function usageFamilyFor(availability, family, monotype) {
  if (!monotype) return family;
  const id = monotypeFamilyId(family, monotype);
  return availability?.familyExtensions?.[id] ? id : family;
}

/**
 * The ladder a usage family's Pokémon are ranked on, as the availability
 * index publishes it: a family's own, and for an extension its base
 * family's.
 * @param {?Object} availability The availability index.
 * @param {?string} family A usage family id.
 * @return {?{label: string, formatOrder: !Array<string>,
 *     cutoffPriority: !Array<number>}} Null when the index has no such
 *     family.
 */
export function rankLadder(availability, family) {
  return availability?.familyConfigs?.[baseFamilyOf(family)] || null;
}

/**
 * The ladder a usage family's sets are read over: the rank ladder, with an
 * extension's own formats ahead of it under the same rating cutoffs.
 * @param {?Object} availability The availability index.
 * @param {?string} family A usage family id.
 * @return {?{formatOrder: !Array<string>, cutoffPriority: !Array<number>}}
 *     Null when the index has no such family.
 */
export function setLadder(availability, family) {
  const ranked = rankLadder(availability, family);
  const extension = availability?.familyExtensions?.[family];
  if (!ranked || (isFamilyExtension(family) && !extension)) return null;
  if (!extension) return ranked;
  return {
    ...ranked,
    formatOrder: [...extension.formatOrder, ...(ranked.formatOrder || [])],
  };
}
