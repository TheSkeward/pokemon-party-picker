// One owned Moon Stone behind a closed stone gate evolves ONE candidate: the
// planner treats such items as copy-limited (like a single-use TM), gives each
// item-evolved form a fallback build that keeps the pre-evolution, and every
// reader of the chosen build agrees on the form it holds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { progressionAt, runPool } from './helpers/harness.mjs';
import {
  contestedEvolutionItems,
} from '../src/playthrough/evolution-requirements.js';
import {
  buildKeyWithoutItems,
  getCurrentSpeciesForChoice,
  withoutItemsBuildKey,
} from '../src/playthrough/current-species.js';
import {
  chooseBuildAssignment,
  noteSingleCopyTms,
} from '../src/teamBuilder/team-selection.js';

const oneStone = (owned = 1) => ({
  ...progressionAt({ badge: 3, levelCap: 40 }),
  evoAccessMoonStone: false,
  ownedItems: { moonstone: owned },
});

test('a gated, owned evolution item is contested; open gates and bare chains are not', () => {
  assert.deepEqual(contestedEvolutionItems('clefable', 'clefairy', oneStone()), [
    { id: 'moonstone', name: 'Moon Stone', copies: 1 },
  ]);
  assert.equal(
    contestedEvolutionItems('clefable', 'clefairy', oneStone(3))[0].copies,
    3,
  );
  // The gate is open: the game supplies stones, nothing is contested.
  const open = { ...oneStone(), evoAccessMoonStone: undefined };
  assert.deepEqual(contestedEvolutionItems('clefable', 'clefairy', open), []);
  // The item is not owned: the evolution is blocked, not contested.
  const unowned = { ...oneStone(), ownedItems: {} };
  assert.deepEqual(contestedEvolutionItems('clefable', 'clefairy', unowned), []);
  // Nothing on the chain spends an item.
  assert.deepEqual(contestedEvolutionItems('nidorino', 'nidoranm', oneStone()), []);
  // Legacy blanket stone gate closes every stone gate.
  const legacy = {
    ...oneStone(),
    evoAccessMoonStone: undefined,
    evoAccessStones: false,
  };
  assert.equal(contestedEvolutionItems('clefable', 'clefairy', legacy).length, 1);
});

test('build keys name the forgone items and the chosen form follows the build', () => {
  const key = withoutItemsBuildKey(['moonstone']);
  assert.deepEqual(buildKeyWithoutItems(key), ['moonstone']);
  assert.deepEqual(buildKeyWithoutItems('default'), []);
  const evolved = getCurrentSpeciesForChoice(
    { inputPokemonId: 'clefairy', pokemonId: 'clefable', buildKey: 'default' },
    oneStone(),
  );
  assert.equal(evolved.id, 'clefable');
  const kept = getCurrentSpeciesForChoice(
    { inputPokemonId: 'clefairy', pokemonId: 'clefable', buildKey: key },
    oneStone(),
  );
  assert.equal(kept.id, 'clefairy');
});

test('build assignment spends an item no more times than the bag holds', () => {
  const build = (name, value, consumedItems = []) => ({
    name,
    value,
    legalityProfile: { consumedItems },
  });
  const stone = [{ id: 'moonstone', name: 'Moon Stone', copies: 1 }];
  const total = (team) => team.reduce((sum, member) => sum + member.value, 0);
  const options = [
    [build('Clefable', 10, stone), build('Clefairy', 5)],
    [build('Nidoking', 9, stone), build('Nidorino', 7)],
  ];
  const honored = chooseBuildAssignment(options, total, true);
  assert.deepEqual(honored.team.map((member) => member.name), ['Clefable', 'Nidorino']);
  const noted = noteSingleCopyTms(honored.team, options, true);
  assert.match(noted[1].note, /Moon Stone: one copy, planned for Clefable/);
  // Two stones: both evolve.
  const twoStones = [{ id: 'moonstone', name: 'Moon Stone', copies: 2 }];
  const roomy = [
    [build('Clefable', 10, twoStones), build('Clefairy', 5)],
    [build('Nidoking', 9, twoStones), build('Nidorino', 7)],
  ];
  assert.equal(chooseBuildAssignment(roomy, total, true).score, 19);
});

test('the optimizer fields at most one Moon Stone evolution per owned stone', async () => {
  const result = await runPool({
    pool: ['Clefairy', 'Nidorino'],
    progression: oneStone(),
  });
  const fielded = result.team.map((choice) => ({
    input: choice.inputName,
    form: getCurrentSpeciesForChoice(choice, oneStone())?.id,
    note: choice.note || '',
    buildKey: choice.buildKey,
  }));
  const evolved = fielded.filter((row) => ['clefable', 'nidoking'].includes(row.form));
  assert.equal(evolved.length, 1, JSON.stringify(fielded));
  const kept = fielded.find((row) => !['clefable', 'nidoking'].includes(row.form));
  assert.equal(kept.buildKey, withoutItemsBuildKey(['moonstone']));
  assert.match(kept.note, /Moon Stone: one copy, planned for/);

  // With the gate open the stone is not contested and both evolve.
  const open = await runPool({
    pool: ['Clefairy', 'Nidorino'],
    progression: { ...oneStone(), evoAccessMoonStone: undefined },
  });
  const openForms = open.team.map(
    (choice) => getCurrentSpeciesForChoice(choice, oneStone())?.id,
  );
  assert.deepEqual(openForms.sort(), ['clefable', 'nidoking']);
});

test('an item the team spends on an evolution is not offered as a held item', async () => {
  const { assignTeamItems, teamMemberKey } = await import(
    '../src/teamBuilder/item-recommendations.js',
  );
  const team = [{
    inputPokemonId: 'clefairy', pokemonId: 'clefable', name: 'Clefable',
    score: 10,
  }];
  const key = teamMemberKey(team[0]);
  const progression = {
    ...progressionAt({ badge: 3, levelCap: 40 }),
    ownedItems: { moonstone: 1, leftovers: 1 },
  };
  const charged = assignTeamItems({
    team, usageByMember: new Map(), ownedItems: progression.ownedItems,
    itemContext: null, progression,
  });
  assert.equal(charged[key].id, 'leftovers');
  // Only the stone in the bag, and the evolution took it: nothing to hold.
  const stoneOnly = { ...progression, ownedItems: { moonstone: 1 } };
  const bare = assignTeamItems({
    team, usageByMember: new Map(), ownedItems: stoneOnly.ownedItems,
    itemContext: null, progression: stoneOnly,
  });
  assert.equal(bare[key], undefined);
  // Without a progression the bag is taken as given, as before.
  const uncharged = assignTeamItems({
    team, usageByMember: new Map(), ownedItems: { moonstone: 1 },
    itemContext: null,
  });
  assert.equal(uncharged[key]?.id, 'moonstone');
});
