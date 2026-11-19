/**
 * @fileoverview Usage families. A usage family names the tier ladder a run
 * reads its competitive prior from. It is a family of the usage data (a
 * tab: "singles") or an extension of one: that family's ladder with further
 * formats ahead of it, read in its place when the run calls for it. A Fire
 * monotype run reads "singles-monofire": what Fire teams ran on Smogon's
 * Monotype ladder, then the Singles ladder.
 *
 * An extension's format has no tiers below it to sort its Pokémon, as the
 * formats of a family sort theirs, so it is split into usage bands: by how
 * many games against such a team it takes to likely meet the Pokémon. Each
 * band stands on the ladder like a format, above the next.
 *
 * An extension holds only what its own formats change. What has no source
 * in them (the move and item tables, the team corpora) is its base
 * family's, and so is the set of any Pokémon they do not rank.
 *
 * The data pipeline (scripts/config.mjs) and the app both read this module,
 * so the ids and the joined ladder are defined once.
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
 * A usage family's ladder as the availability index publishes it. A
 * family's is its formats under its rating cutoffs. An extension's is its
 * own formats, each split into its usage bands, and then its base family's
 * ladder, under the base family's cutoffs.
 * @param {?Object} availability The availability index.
 * @param {?string} family A usage family id.
 * @return {?{label: string, formatOrder: !Array<string>,
 *     cutoffPriority: !Array<number>, ownFormats: !Array<string>,
 *     bandGames: !Array<number>, tierCount: number}} `ownFormats` and
 *     `bandGames` are an extension's formats and the horizon, in games, of
 *     each band they are split into (both empty for a family); `tierCount`
 *     is the number of tiers a rank is scaled by. Null when the index has
 *     no such family.
 */
export function usageLadder(availability, family) {
  const base = availability?.familyConfigs?.[baseFamilyOf(family)];
  const extension = availability?.familyExtensions?.[family];
  if (!base || (isFamilyExtension(family) && !extension)) return null;
  const cutoffs = (base.cutoffPriority || []).length;
  const ownFormats = extension?.formatOrder || [];
  const bandGames = extension?.bandGames || [];
  return {
    ...base,
    label: extension?.label || base.label,
    formatOrder: [...ownFormats, ...(base.formatOrder || [])],
    ownFormats,
    bandGames,
    tierCount:
      (ownFormats.length * bandGames.length +
        (base.formatOrder || []).length) * cutoffs,
  };
}
