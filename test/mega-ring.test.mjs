// Mega Evolution needs the game's Mega ring. Reborn's Mega-Z Ring comes from
// DJ Arclight's quest after Titania (badge 15). Before that the Mega stays the
// line's usage representative, so the line is judged by the record of the
// Pokémon the ladder runs, but the player fields the base form with its own
// body and caught ability and spends no Mega slot. The progression's gate
// overrides the schedule in either direction.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bestChoice,
  progressionAt,
  runPool,
} from './helpers/harness.mjs';

const { normalizeProgression } = await import(
  '../src/playthrough/progression.js',
);
const { buildTeamAnalysis } = await import(
  '../src/teamBuilder/team-analysis.js',
);

test('before the ring, a Lopunny line fields Lopunny and spends no Mega slot', async () => {
  const progression = progressionAt({ badge: 1, levelCap: 25 });
  const result = await runPool({ pool: ['Buneary'], progression });
  const choice = bestChoice(result, 'Buneary');
  // The Mega is still the line's representative; the body is Lopunny's.
  assert.equal(choice.pokemonId, 'lopunnymega');
  assert.equal(choice.legalityProfile.fieldedName, 'Lopunny');
  assert.equal(choice.isMega, false);
  assert.equal(choice.legalityProfile.megaReady, false);
  assert.equal(choice.legalityProfile.fieldedId, 'lopunny');
  assert.equal(choice.legalityProfile.currentId, 'lopunny');
  assert.notEqual(choice.legalityProfile.assumedAbility, 'Scrappy');
  assert.equal(result.megaUsed, null);

  const analysis = await buildTeamAnalysis(result.team, progression, {
    family: 'singles', selection: 'all', lines: result.lines,
  });
  const shown = analysis.profiles[0];
  assert.equal(shown.megaReady, false);
  assert.equal(shown.recommendedSet.species, 'Lopunny');
});

test('after Titania the Mega is fielded, and the gate overrides both ways', async () => {
  const late = await runPool({
    pool: ['Buneary'],
    progression: progressionAt({ badge: 15, levelCap: 90 }),
  });
  const ready = bestChoice(late, 'Buneary');
  assert.equal(ready.isMega, true);
  assert.equal(ready.legalityProfile.megaReady, true);
  assert.equal(ready.legalityProfile.currentId, 'lopunnymega');
  assert.equal(late.megaUsed?.pokemonId, 'lopunnymega');

  const earlyRing = await runPool({
    pool: ['Buneary'],
    progression: {
      ...progressionAt({ badge: 1, levelCap: 25 }), evoAccessMegaRing: true,
    },
  });
  assert.equal(
    bestChoice(earlyRing, 'Buneary').legalityProfile.currentId, 'lopunnymega',
  );

  const noQuest = await runPool({
    pool: ['Buneary'],
    progression: {
      ...progressionAt({ badge: 15, levelCap: 90 }), evoAccessMegaRing: false,
    },
  });
  const held = bestChoice(noQuest, 'Buneary');
  assert.equal(held.legalityProfile.megaReady, false);
  assert.equal(held.legalityProfile.currentId, 'lopunny');
  assert.equal(held.isMega, false);
});

test('a plain Sharpedo keeps its line\'s usage record before the ring', async () => {
  // Plain Sharpedo has near-zero ladder usage because the ladder runs Mega
  // Sharpedo. The ring decides the body, not the evidence, so the Speed
  // Boost Sharpedo at cap 50 is not dragged toward a zero-usage ceiling.
  const result = await runPool({
    pool: ['Sharpedo', 'Blaziken'],
    progression: progressionAt({ badge: 5, levelCap: 50 }),
  });
  const sharpedo = bestChoice(result, 'Sharpedo');
  const blaziken = bestChoice(result, 'Blaziken');
  assert.equal(sharpedo.legalityProfile.currentId, 'sharpedo');
  assert.equal(sharpedo.legalityProfile.megaReady, false);
  assert.equal(sharpedo.legalityProfile.assumedAbility, 'Speed Boost');
  assert.ok(
    sharpedo.score > 0.85 * blaziken.score,
    `Sharpedo ${Math.round(sharpedo.score)} vs Blaziken ${Math.round(blaziken.score)}`,
  );
});

test('the ring gate keeps an explicit true as well as false', () => {
  assert.equal(normalizeProgression({}).evoAccessMegaRing, undefined);
  assert.equal(
    normalizeProgression({ evoAccessMegaRing: true }).evoAccessMegaRing, true,
  );
  assert.equal(
    normalizeProgression({ evoAccessMegaRing: false }).evoAccessMegaRing,
    false,
  );
  // Other gates still drop true: absent already means accessible for them.
  assert.equal(
    normalizeProgression({ evoAccessMoonStone: true }).evoAccessMoonStone,
    undefined,
  );
});
