/**
 * @fileoverview Generates the evolutionary-line table the resolver uses to
 * turn an input species into the forms its line can field: species id → the
 * line's members, in dex order with megas last. A line is a connected
 * component of the evolution graph (prevo/evos edges), with each mega —
 * including the community Z-Megas the dex names "Mega-Z" without flagging
 * — attached to its base species; a form outside the graph (Pikachu-Original,
 * Rotom-Wash, Giratina-Origin) stands alone. Members sort megas last, then
 * by dex number, then by id; keys are sorted so the output is reproducible
 * across dex versions.
 *
 *   node scripts/build-line-representatives.mjs [gen]
 *
 * Universe: for Gen 7 the whole dex object as @pkmn/dex serves it for that
 * generation — later-generation forms of old species, community megas the
 * dex marks Future, CAP creations — because Reborn fields community megas
 * and the resolver must know their lines. Other generations keep the
 * standard species of that generation and earlier.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Dex } from '@pkmn/dex';
import { inUniverse, parseGenArg } from './dex-gen.mjs';

function main() {
  const gen = parseGenArg();
  const dex = Dex.forGen(gen);
  const listed = dex.species.all().filter((species) => species.exists);
  const universe =
    gen === 7
      ? listed
      : listed.filter((species) => inUniverse(gen, species));
  const byId = new Map(universe.map((species) => [species.id, species]));
  const idOf = (name) => dex.species.get(name).id;
  const isMegaLike = (species) =>
    Boolean(species.isMega) || /mega/i.test(species.forme || '');

  // Union-find over the evolution graph plus mega → base edges.
  const parent = new Map(universe.map((species) => [species.id, species.id]));
  const find = (id) => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root);
    let cursor = id;
    while (parent.get(cursor) !== root) {
      const next = parent.get(cursor);
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  };
  const union = (a, b) => {
    if (!byId.has(a) || !byId.has(b)) return;
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const species of universe) {
    if (species.prevo) union(species.id, idOf(species.prevo));
    for (const evo of species.evos || []) union(species.id, idOf(evo));
    if (isMegaLike(species) && species.baseSpecies) {
      union(species.id, idOf(species.baseSpecies));
    }
  }

  const members = new Map();
  for (const species of universe) {
    const root = find(species.id);
    if (!members.has(root)) members.set(root, []);
    members.get(root).push(species);
  }
  const order = (a, b) =>
    Number(isMegaLike(a)) - Number(isMegaLike(b)) ||
    a.num - b.num ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  const table = {};
  const sortedUniverse = universe
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const species of sortedUniverse) {
    table[species.id] = members
      .get(find(species.id))
      .slice()
      .sort(order)
      .map((member) => ({
        id: member.id,
        name: member.name,
        isMega: isMegaLike(member),
      }));
  }

  const outPath = path.resolve(
    'src', 'generated', `gen${gen}LineRepresentativeCandidates.generated.js`);
  const body = `// Generated from @pkmn/dex Gen ${gen} evolution/form data.
// Do not edit by hand.

export const LINE_REPRESENTATIVE_CANDIDATES = ${JSON.stringify(table, null, 2)};
`;
  fs.writeFileSync(outPath, body);
  console.log(
    `Wrote Gen ${gen} line representatives for ${universe.length} species.`);
}

main();
