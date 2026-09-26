import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatAbilityPath,
  resolveBuildAbilities,
} from '../src/teamBuilder/ability-path.js';
import {
  buildCandidateLegalityProfile,
  buildTeamAnalysis,
  formatShowdownSet,
} from '../src/teamBuilder/team-analysis.js';
import { renderTeamAnalysisPanel } from '../src/teamBuilder/team-analysis-view.js';
import { progressionAt, runPool } from './helpers/harness.mjs';

const cameruptSet = {
  ability: 'Solid Rock',
  abilities: [
    { name: 'Solid Rock', usage: 90 },
    { name: 'Magma Armor', usage: 9 },
    { name: 'Anger Point', usage: 1 },
  ],
};

function numelPath(overrides = {}) {
  return resolveBuildAbilities({
    inputId: 'numel',
    currentId: 'numel',
    representativeId: 'camerupt',
    topSet: cameruptSet,
    ...overrides,
  });
}

test('canonical abilities map by evolutionary slot, not competitive usage order', () => {
  const path = numelPath();
  assert.equal(path.assumedAbility, 'Simple');
  assert.equal(path.targetAbility, 'Solid Rock');
  assert.equal(path.inputAbility, 'Simple');
  assert.equal(path.secondaryAbility, 'Oblivious');
  assert.deepEqual(path.abilityOptions.map((entry) => entry.name), [
    'Simple', 'Oblivious', 'Own Tempo',
  ]);
  assert.equal(formatAbilityPath(path.assumedAbility, path.targetAbility),
    'Simple / Solid Rock');
  assert.equal(formatAbilityPath('Torrent', 'Torrent'), 'Torrent');
});

test('input annotations follow their slot through evolution, including hidden abilities', () => {
  const pinned = numelPath({ abilityOverride: 'Oblivious' });
  assert.equal(pinned.assumedAbility, 'Oblivious');
  assert.equal(pinned.targetAbility, 'Magma Armor');
  assert.equal(pinned.abilityKnown, true);
  assert.equal(pinned.secondaryAbility, null);

  const evolved = numelPath({ currentId: 'camerupt', abilityOverride: 'Own Tempo' });
  assert.equal(evolved.assumedAbility, 'Anger Point');
  assert.equal(evolved.inputAbility, 'Own Tempo');
  assert.equal(evolved.abilityKnown, true);
  // A future ability is not a valid annotation for the caught Numel.
  assert.equal(numelPath({ abilityOverride: 'Solid Rock' }).abilityKnown, false);
});

test('single-ability intermediate forms retain the target path', () => {
  const vigoroth = resolveBuildAbilities({
    inputId: 'slakoth', currentId: 'vigoroth', representativeId: 'slaking',
    topSet: { ability: 'Truant' },
  });
  assert.equal(vigoroth.assumedAbility, 'Vital Spirit');
  assert.equal(vigoroth.targetAbility, 'Truant');

  const metapod = resolveBuildAbilities({
    inputId: 'metapod', currentId: 'metapod', representativeId: 'butterfree',
    topSet: { ability: 'Tinted Lens' }, abilityOverride: 'Shed Skin',
  });
  assert.equal(metapod.assumedAbility, 'Shed Skin');
  assert.equal(metapod.targetAbility, 'Tinted Lens');
});

test('Mega paths retain current, pre-Mega, and active Mega abilities', () => {
  const options = {
    inputId: 'numel', currentId: 'numel', representativeId: 'cameruptmega',
    topSet: { ability: 'Sheer Force' }, baseTopSet: cameruptSet,
  };
  const early = resolveBuildAbilities(options);
  assert.equal(early.assumedAbility, 'Simple');
  assert.equal(early.targetAbility, 'Sheer Force');
  assert.equal(early.preMegaAbility, null);

  const ready = resolveBuildAbilities({ ...options, currentId: 'camerupt', megaReady: true });
  assert.equal(ready.assumedAbility, 'Sheer Force');
  assert.equal(ready.preMegaAbility, 'Solid Rock');
  assert.equal(ready.inputAbility, 'Simple');
});

test('damage uses the current ability instead of borrowing future Technician', () => {
  const path = resolveBuildAbilities({
    inputId: 'shroomish', currentId: 'shroomish', representativeId: 'breloom',
    topSet: { ability: 'Technician' },
  });
  assert.equal(path.assumedAbility, 'Quick Feet');
  const options = {
    member: { id: 'shroomish', name: 'Shroomish', types: ['Grass'] },
    levelCap: 20,
    moves: [{
      id: 'tackle', name: 'Tackle', type: 'Normal', category: 'Physical',
      basePower: 40, accuracy: 100, roles: [], availableSources: [],
    }],
  };
  const current = buildCandidateLegalityProfile({
    ...options, ability: path.assumedAbility,
  });
  const ordinary = buildCandidateLegalityProfile(options);
  const future = buildCandidateLegalityProfile({
    ...options, ability: path.targetAbility,
  });
  assert.equal(current.bestDamagingMove.estimatedDamage,
    ordinary.bestDamagingMove.estimatedDamage);
  assert.ok(future.bestDamagingMove.estimatedDamage >
    current.bestDamagingMove.estimatedDamage);
});

test('optimizer, analysis, display, and export agree on current / eventual abilities', async () => {
  const progression = progressionAt({ badge: 1, levelCap: 25 });
  const result = await runPool({ pool: ['Numel', 'Slakoth'], progression });
  const expected = {
    numel: ['Simple', 'Solid Rock'],
    vigoroth: ['Vital Spirit', 'Truant'],
  };
  for (const row of result.team) {
    const profile = row.legalityProfile;
    assert.deepEqual([profile.assumedAbility, profile.targetAbility],
      expected[profile.currentId]);
  }
  const analysis = await buildTeamAnalysis(result.team, progression, {
    family: 'singles', selection: 'all', lines: result.lines,
  });
  for (const profile of analysis.profiles) {
    const [current, eventual] = expected[profile.currentId];
    assert.equal(profile.assumedAbility, current);
    assert.equal(profile.recommendedSet.ability, current);
    assert.equal(profile.recommendedSet.targetAbility, eventual);
    assert.ok(formatShowdownSet(profile.recommendedSet).includes(
      `Ability: ${current} / ${eventual}`));
  }
  const root = {
    innerHTML: '', isConnected: true,
    ownerDocument: { querySelectorAll: () => [] },
  };
  const options = {
    family: 'singles', selection: 'all', progression,
    team: result.team, lines: result.lines,
  };
  await renderTeamAnalysisPanel(root, options);
  assert.ok(root.innerHTML.includes('Simple / Solid Rock'));
  assert.ok(root.innerHTML.includes('Vital Spirit / Truant'));

  // Same species/build/moves, different caught ability: do not reuse the
  // settled panel for the previous ability path.
  const pinnedTeam = structuredClone(result.team);
  const numel = pinnedTeam.find((row) => row.legalityProfile.currentId === 'numel');
  Object.assign(numel.legalityProfile, { abilityKnown: true, inputAbility: 'Oblivious' });
  await renderTeamAnalysisPanel(root, { ...options, team: pinnedTeam });
  assert.ok(root.innerHTML.includes('Oblivious / Magma Armor'));
  assert.ok(!root.innerHTML.includes('Simple / Solid Rock'));
});

test('once evolved, the active ability is shown only once', async () => {
  const progression = progressionAt({ badge: 5, levelCap: 45 });
  const result = await runPool({ pool: ['Numel (Simple)'], progression });
  const row = result.lines[0].choiceOptions.find((choice) => choice.pokemonId === 'camerupt');
  assert.ok(row);
  assert.equal(row.legalityProfile.assumedAbility, 'Solid Rock');
  assert.equal(row.legalityProfile.targetAbility, null);
  assert.equal(row.legalityProfile.inputAbility, 'Simple');
  assert.equal(row.legalityProfile.abilityKnown, true);
  const analysis = await buildTeamAnalysis([row], progression, {
    family: 'singles', selection: 'all',
  });
  const set = analysis.profiles[0].recommendedSet;
  assert.equal(set.ability, 'Solid Rock');
  assert.equal(set.targetAbility, null);
  assert.match(formatShowdownSet(set), /Ability: Solid Rock\n/);
});
