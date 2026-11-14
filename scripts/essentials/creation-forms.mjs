/**
 * @fileoverview The form a wild Pokémon is made in where its species, not
 * the encounter table, decides it. A species may carry a creation rule
 * (mons.dat `formInit`, the `OnCreation` proc of its data), and the
 * generator evaluates it when the table names no form. Most rules go by
 * the map: a regional form lives on the maps a list in the constants file
 * names. Without them every wild Pokémon reads as its first form, and an
 * Alolan Geodude is credited with an Everstone it never holds.
 */
import { RubySymbol, toPlain } from './game-files.mjs';

const BY_MAP =
  /^next \$game_map && (\w+)\.include\?\(\$game_map\.map_id\) \? (\d+) : (\d+)$/;
const RANDOM = /^rand\((\d+)\)$/;

const range = (count) => Array.from({ length: count }, (_, index) => index);

/**
 * Where the generator applies a species' creation rule, and how the
 * encounters extract states its outcome.
 * @param {!RubySource} field The file that defines pbGenerateWildPokemon.
 * @return {!Object}
 */
export function readCreationFormRule(field) {
  const start = field.find(/^def pbGenerateWildPokemon/).line;
  const { line } = field.find(/formInit\.is_a\?\(String\) && form\.nil\?/, start);
  return {
    source: field.cite(line, line + 1),
    rule: 'a slot without `form` is form 0; a number is the form the ' +
      'species\' creation rule (mons.dat formInit) gives on that map, ' +
      'counted from 0 in the order the wild-items extract lists the ' +
      'forms of a species; a list is the forms a rule can give that does ' +
      'not go by the map: at random, or by the hour, the season or the ' +
      'battle\'s field',
  };
}

/**
 * @param {!RubySource} constants The game's constants file.
 * @return {!Map<string, !Array<number>>} Every list of numbers it defines
 *     (`Name = [1, 2, ...]`), which is how the map lists are written.
 */
export function readMapLists(constants) {
  const lists = new Map();
  const text = constants.lines.join('\n');
  for (const [, name, body] of text.matchAll(/^(\w+)\s*=\s*\[([^\]]*)\]/gm)) {
    const entries = body.replace(/#.*$/gm, '').split(',')
      .map((entry) => entry.trim()).filter(Boolean);
    if (entries.every((entry) => /^\d+$/.test(entry))) {
      lists.set(name, entries.map(Number));
    }
  }
  return lists;
}

// A creation rule's text as one statement list: comments and the proc's
// braces gone, whitespace single.
function ruleBody(formInit) {
  return String(formInit)
    .replace(/#.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^proc \{\s*/, '')
    .replace(/\s*\}$/, '');
}

// The forms a rule can give when it does not go by the map: a remainder's
// range, else every number it hands back.
function formsOf(body, species) {
  const random = RANDOM.exec(body);
  if (random) return range(Number(random[1]));
  const modulo = /% (\d+)\b/.exec(body);
  if (modulo) return range(Number(modulo[1]));
  const given = [...body.matchAll(/\bnext (\d+)\b/g)].map(([, form]) =>
    Number(form));
  if (!given.length) {
    throw new Error(`${species}: creation rule not understood: ${body}`);
  }
  return [...new Set(given)].sort((a, b) => a - b);
}

/**
 * @param {!Map} mons Parsed (not plain) mons.dat.
 * @param {!Map<string, !Array<number>>} mapLists From readMapLists.
 * @return {function(string, number): (number|!Array<number>|undefined)}
 *     Given a species and a map id, the form selector a slot there
 *     carries: a form number, a list of them, or undefined for form 0 and
 *     for a species with no rule.
 */
export function creationFormReader(mons, mapLists) {
  const rules = new Map();
  for (const [key, wrapper] of mons) {
    if (!(key instanceof RubySymbol)) continue;
    const formInit = toPlain(wrapper.ivars.get('@formInit'));
    if (typeof formInit === 'string' && formInit.trim()) {
      rules.set(key.name, ruleBody(formInit));
    }
  }
  return (species, mapId) => {
    const body = rules.get(species);
    if (!body) return undefined;
    const byMap = BY_MAP.exec(body);
    if (!byMap) return formsOf(body, species);
    const maps = mapLists.get(byMap[1]);
    if (!maps) {
      throw new Error(`${species}: no map list named ${byMap[1]}`);
    }
    const form = Number(maps.includes(mapId) ? byMap[2] : byMap[3]);
    return form === 0 ? undefined : form;
  };
}

/**
 * @param {!Array<!Object>} tables Maps with their encounter tables, from
 *     extractEncounters.
 * @param {function(string, number): (number|!Array<number>|undefined)}
 *     formOf From creationFormReader.
 * @return {!Array<!Object>} The same, each slot that named no form
 *     carrying the one its species' creation rule gives on the map.
 */
export function withCreationForms(tables, formOf) {
  return tables.map((table) => ({
    ...table,
    types: Object.fromEntries(
      Object.entries(table.types).map(([type, slots]) => [
        type,
        slots.map((slot) => {
          if (slot.form !== undefined) return slot;
          const form = formOf(slot.species, table.mapId);
          if (form === undefined) return slot;
          const { species, ...rest } = slot;
          return { species, form, ...rest };
        }),
      ]),
    ),
  }));
}
