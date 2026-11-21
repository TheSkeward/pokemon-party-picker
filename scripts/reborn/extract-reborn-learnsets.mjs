/**
 * @fileoverview Extracts level-up (incl. level-0 evolution moves), egg, and
 * TM/tutor-compatible move lists from Reborn's compiled mons.dat, keyed by our
 * pokemon-index ids. Reborn is the authoritative learnset source for the game
 * this tool targets; mainline @pkmn/dex diverges (e.g. Bibarel's evolution
 * move is Water Gun in Reborn, Aqua Jet in USUM).
 *
 * An id gets a learnset only when the game has that Pokémon, so the result
 * is also the list of the index's Pokémon that are in Reborn: the species
 * table and the legal-move files are built for these ids alone.
 */

import { readFileSync } from 'node:fs';
import { Dex } from '@pkmn/dex';
import { toId } from '../../src/utils/ids.js';
import { parseMarshal, RubySymbol } from '../essentials/parse-marshal.mjs';

const dex = Dex.forGen(7);

// Reborn move-name → our move id where they differ.
const MOVE_ALIASES = { vicegrip: 'visegrip', hijumpkick: 'highjumpkick' };
// Our species id → Reborn species id where they differ (Reborn keeps the gender
// suffix on the Nidoran symbols).
const SPECIES_ALIASES = { nidoranf: 'nidoranfe', nidoranm: 'nidoranma' };
const moveId = (sym) => {
  const id = toId(sym.name);
  return MOVE_ALIASES[id] || id;
};

/**
 * @param {string} monsDatPath
 * @return {!Map<string, !Map<string, !Object>>} Base species id →
 *     (Reborn form name → MonData RubyObject).
 */
export function loadRebornMons(monsDatPath) {
  const top = parseMarshal(readFileSync(monsDatPath));
  // base species id → { species symbol, forms: Map(formName → MonData) }
  const bySpecies = new Map();
  for (const [key, wrapper] of top) {
    if (!(key instanceof RubySymbol)) continue;
    const pokemonData = wrapper.ivars.get('@pokemonData');
    if (!pokemonData) continue;
    const forms = new Map();
    for (const [formKey, monData] of pokemonData) {
      forms.set(formKey.rubyString ?? String(formKey), monData);
    }
    bySpecies.set(toId(key.name), forms);
  }
  return bySpecies;
}

// Normalised form token for matching Reborn form names against @pkmn/dex
// formes.
const normForm = (name) =>
  toId(String(name).replace(/\b(form|forme)\b/gi, ''));

const hasMoveset = (monData) =>
  monData && (monData.ivars.get('@Moveset') || []).length > 0;

// Prefer the requested form, but Mega/Primal/Arceus-plate/etc. forms carry an
// empty moveset in Reborn (they share the base learnset, stored only on the
// canonical form), so fall back to Normal Form, then to any form that actually
// holds a moveset.
function pickMonData(forms, preferred) {
  if (hasMoveset(preferred)) return preferred;
  const normal = forms.get('Normal Form');
  if (hasMoveset(normal)) return normal;
  for (const monData of forms.values()) if (hasMoveset(monData)) return monData;
  return preferred || normal || [...forms.values()][0];
}

// What makes a form the Pokémon it is, for telling whether a dex species and
// a Reborn form are the same one: its base stats (both sides order them HP,
// Attack, Defense, Sp. Atk, Sp. Def, Speed), its types and its weight, which
// Reborn keeps in tenths of a kilogram. Weight is what tells a size from
// another where the stats agree: a totem is its species at several times
// the weight. A Reborn form entry states only what differs from the
// species' default form.
const identity = (stats, types, weight) =>
  `${stats.join('/')} ${[...new Set(types.map(toId))].sort().join('/')} ` +
  `${Math.round(weight)}`;
const dexIdentity = (species) =>
  identity(
    ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(
      (stat) => species.baseStats[stat]),
    species.types,
    species.weightkg * 10,
  );
function formIdentity(monData, base) {
  const own = (field) => monData.ivars.get(field) ?? base.ivars.get(field);
  return identity(
    [...own('@BaseStats')],
    [own('@Type1'), own('@Type2')].filter(Boolean).map((type) => type.name),
    own('@Weight'),
  );
}

const rebornForms = (species, ourId, bySpecies) => {
  const baseId = species?.exists
    ? toId(species.baseSpecies || species.name)
    : ourId;
  const lookup = (id) => bySpecies.get(SPECIES_ALIASES[id] || id);
  return { baseId, forms: lookup(baseId) || lookup(ourId) };
};

/**
 * The dex forme that Reborn's default form of a species is, where that is
 * not the dex's own default: Reborn's Gourgeist comes in two sizes, and the
 * default one has the stats the dex gives Gourgeist-Super.
 * @param {string} ourId A species id with no forme.
 * @param {!Map<string, !Map<string, !Object>>} bySpecies
 * @return {?string} The forme's id; null where the defaults agree, and
 *     where no forme of the dex has the default form's stats either.
 */
function defaultFormeId(ourId, bySpecies) {
  const species = dex.species.get(ourId);
  if (!species?.exists || species.forme) return null;
  const { forms } = rebornForms(species, ourId, bySpecies);
  if (!forms) return null;
  const base = pickMonData(forms, forms.get('Normal Form'));
  const game = formIdentity(base, base);
  if (game === dexIdentity(species)) return null;
  const forme = (species.otherFormes || [])
    .map((name) => dex.species.get(name))
    .find((other) => other.exists && dexIdentity(other) === game);
  return forme?.id || null;
}

// Resolves the form to read for this id, plus the canonical (base-learnset)
// form to back-fill from. Alolan Raichu et al. carry their own learnset;
// Mega/Primal/ Arceus-plate forms share the base's, and Kyurem's fusion forms
// carry their own moveset but an empty compatible-moves list — so each field
// falls back to the base form independently.
function resolveMonData(ourId, bySpecies) {
  const species = dex.species.get(ourId);
  const { baseId, forms } = rebornForms(species, ourId, bySpecies);
  if (!forms) return null;

  const base = pickMonData(forms, forms.get('Normal Form'));
  if (!species?.forme) {
    // The dex's default form is not in the game where Reborn's default is
    // another forme of the dex (defaultFormeId): that forme's id reads it.
    return defaultFormeId(ourId, bySpecies) ? null : { primary: base, base };
  }

  const target = normForm(species.forme);
  for (const [formName, monData] of forms) {
    // Some Reborn form names carry the species ("Hoopa Unbound", "White
    // Kyurem"); drop it so the token compares to the dex forme alone.
    const token = normForm(formName).replace(baseId, '');
    if (
      token &&
      (token === target || token.startsWith(target) || target.startsWith(token))
    ) {
      return { primary: pickMonData(forms, monData), base };
    }
  }
  // A forme with no form entry under its name is in the game only as a form
  // that is the same Pokémon: Gourgeist-Super reads Reborn's default
  // Gourgeist, a cap Pikachu its Pikachu. One that no form matches
  // (Gourgeist-Large, Ash-Greninja, a totem), or that is newer than Reborn's
  // dex (Hisuian Arcanine), is not in the game, and the base's learnset is
  // not a stand-in.
  if (species.gen > dex.gen) return null;
  const wanted = dexIdentity(species);
  const same = [base, ...forms.values()].find(
    (monData) => monData?.ivars && formIdentity(monData, base) === wanted);
  return same ? { primary: pickMonData(forms, same), base } : null;
}

const moveList = (monData, field) =>
  (monData.ivars.get(field) || []).map(moveId);

// Reads a list field from the form, falling back to the base form when the form
// leaves it empty (fusion forms carry their own moveset but no compatible
// list).
const listWithBase = (primary, base, field) => {
  const own = moveList(primary, field);
  return own.length || primary === base ? own : moveList(base, field);
};

function extractMoves(primary, base) {
  const moveset = (primary.ivars.get('@Moveset') || []).length
    ? primary.ivars.get('@Moveset')
    : base.ivars.get('@Moveset') || [];
  const levelUp = []; // [level, moveId] for level >= 1
  const evolutionMoves = []; // moves at level 0
  for (const [level, sym] of moveset) {
    const id = moveId(sym);
    if (level === 0) evolutionMoves.push(id);
    else levelUp.push([level, id]);
  }
  return {
    levelUp,
    evolutionMoves,
    eggMoves: listWithBase(primary, base, '@EggMoves'),
    compatibleMoves: listWithBase(primary, base, '@compatiblemoves'),
    relearnerMoves: listWithBase(primary, base, '@RelearnerMoves'),
  };
}

/**
 * @param {string} monsDatPath
 * @param {!Array<{id: string}>} pokemonIndex
 * @return {{learnsets: !Object<string, !Object>, unmapped: !Array<string>,
 *     defaultFormes: !Object<string, string>}}
 *     Learnsets keyed by pokemon id (levelUp/evolutionMoves/eggMoves/
 *     compatibleMoves/relearnerMoves), which is also the list of the index's
 *     Pokémon the game has; unmapped lists the ids it lacks. defaultFormes
 *     maps a species id to the forme id Reborn's default form of it is
 *     (defaultFormeId), for the species whose plain id is unmapped because
 *     of it.
 */
export function buildRebornLearnsets(monsDatPath, pokemonIndex) {
  const bySpecies = loadRebornMons(monsDatPath);
  const learnsets = {};
  const unmapped = [];
  const defaultFormes = {};
  for (const pokemon of pokemonIndex) {
    const resolved = resolveMonData(pokemon.id, bySpecies);
    if (!resolved) {
      unmapped.push(pokemon.id);
      const formeId = defaultFormeId(pokemon.id, bySpecies);
      if (formeId) defaultFormes[pokemon.id] = formeId;
      continue;
    }
    learnsets[pokemon.id] = extractMoves(resolved.primary, resolved.base);
  }
  return { learnsets, unmapped, defaultFormes };
}
