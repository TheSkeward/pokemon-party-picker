import test from 'node:test';
import assert from 'node:assert/strict';
import { Dex } from '@pkmn/dex';

const { analysisTypes, getTypeMultiplier } = await import(
  '../src/playthrough/type-chart.js',
);

const CANONICAL_ORDER = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison',
  'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark',
  'Steel', 'Fairy',
];

test('the active game exposes the 18 Gen 7 types in grid order', () => {
  assert.deepEqual(analysisTypes(), CANONICAL_ORDER);
});

test('the generated chart reproduces the dex for every typing', () => {
  const dex = Dex.forGen(7);
  const fromDex = (attack, defenses) => {
    let multiplier = 1;
    for (const defense of defenses) {
      const code = dex.types.get(defense).damageTaken[attack] || 0;
      if (code === 3) return 0;
      if (code === 1) multiplier *= 2;
      if (code === 2) multiplier *= 0.5;
    }
    return multiplier;
  };
  const types = analysisTypes();
  for (const attack of types) {
    for (const first of types) {
      assert.equal(
        getTypeMultiplier(attack, [first]), fromDex(attack, [first]));
      for (const second of types) {
        assert.equal(
          getTypeMultiplier(attack, [first, second]),
          fromDex(attack, [first, second]),
          `${attack} into ${first}/${second}`,
        );
      }
    }
  }
});

test('generation-specific facts read from the chart, not the engine', () => {
  assert.equal(getTypeMultiplier('Dragon', ['Fairy']), 0);
  // Gen 6 removed Steel's Ghost and Dark resistances; a Gen 4 chart keeps
  // them, and nothing in the engine assumes either answer.
  assert.equal(getTypeMultiplier('Ghost', ['Steel']), 1);
  assert.equal(getTypeMultiplier('Unknown', ['Steel']), 1);
});
