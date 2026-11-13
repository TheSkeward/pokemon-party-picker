/**
 * @fileoverview What maps.dat says of each map: its wild encounter tables
 * and the switches the map exists under. maps.dat is the file Cache.rb
 * loads; encounters.dat is only the map editor's copy.
 */

// How pbDetermineForm reads a slot's form selector: a Range is the forms
// it spans.
function formSelector(form) {
  if (form === null || typeof form !== 'object' || Array.isArray(form)) {
    return form;
  }
  const last = form.excl ? form.end - 1 : form.end;
  return Array.from(
    { length: last - form.begin + 1 }, (_, i) => form.begin + i);
}

/**
 * Wild encounter tables per map. A table stores each species with its
 * slots, and each slot carries its own rate. A table may key a species
 * with a form selector, which the slot then carries as `form`: a form
 * number, a list of numbers, or the name of a rule (readSlotFormRule).
 * @param {!Array} mapData Plain maps.dat.
 * @param {!Map} mapInfos Plain MapInfos.rxdata.
 * @param {!Array<!Array<string>>} encounterTypes The game's encounter
 *     types as [type, density] pairs, in the order PokemonEncounters#setup
 *     reads them; a density is the map rate (`<density>rate`) the type
 *     draws on.
 * @return {!Array<!Object>} Maps that have a table, sorted by map id.
 */
export function extractEncounters(mapData, mapInfos, encounterTypes) {
  const densities = [...new Set(encounterTypes.map(([, density]) => density))];
  const maps = [];
  for (const meta of mapData) {
    if (!meta) continue;
    const types = {};
    for (const [type] of encounterTypes) {
      const table = meta[type];
      if (!table) continue;
      types[type] = [...table].flatMap(([key, slots]) => {
        const who = Array.isArray(key)
          ? { species: key[0], form: formSelector(key[1]) }
          : { species: key };
        return slots.map(([rate, min, max]) => ({ ...who, min, max, rate }));
      });
    }
    if (!Object.keys(types).length) continue;
    maps.push({
      mapId: meta.mapid,
      mapName: mapInfos.get(meta.mapid)?.name ?? null,
      density: Object.fromEntries(
        densities.map((density) => [density, meta[`${density}rate`] ?? 0])),
      types,
    });
  }
  return maps.sort((a, b) => a.mapId - b.mapId);
}

/**
 * How a table slot's form selector picks the form met, as
 * PokemonEncounters#pbDetermineForm implements it.
 * @param {!RubySource} encounters The file that defines pbDetermineForm.
 * @return {!Object}
 */
export function readSlotFormRule(encounters) {
  const start = encounters.find(/^\s*def pbDetermineForm\(/).line;
  const end = encounters.find(/^\s*raise "unknown form/, start).line + 1;
  const lure = encounters.find(/\$Trainer\.party\[0\]\.item == :(\w+)/, start);
  const named = [...encounters.text(start, end).matchAll(/form == :(\w+)/g)];
  return {
    source: encounters.cite(start, end),
    rule: 'a slot without `form` is form 0; a number is that form, ' +
      'counted from 0 in the order the wild-items extract lists the ' +
      'forms of a species; a list is picked from at random, or is the ' +
      'form of the party lead while it holds the lure item; a name is a ' +
      'rule the game picks by',
    lureItem: lure.match[1],
    namedRules: named.map((match) => match[1]),
  };
}

/**
 * @param {!RubySource} constants The file that defines `Switches`.
 * @return {!Map<string, number>} Named switch symbol → switch id.
 */
export function readNamedSwitches(constants) {
  const start = constants.find(/^Switches = \{/).line;
  const end = constants.find(/^\}/, start).line;
  const out = new Map();
  for (const line of constants.lines.slice(start, end - 1)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*):\s*(\d+)/);
    if (match) out.set(match[1], Number(match[2]));
  }
  return out;
}

/**
 * @param {!Map<string, number>} namedSwitches From readNamedSwitches.
 * @param {!Object} system Plain System.rxdata.
 * @return {function(?Object): !Array<!Object>} Given a map's plain
 *     maps.dat entry, the switches it exists under, each with its id and
 *     System.rxdata name.
 */
export function mapSwitchReader(namedSwitches, system) {
  return (meta) =>
    (meta?.Switches ?? []).map(([symbol, value]) => ({
      switch: namedSwitches.get(symbol) ?? null,
      symbol,
      name: system.switches[namedSwitches.get(symbol)] ?? null,
      is: value,
    }));
}
