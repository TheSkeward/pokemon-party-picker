// An interim individual: a canonical move is egg-only and no egg can be made
// yet, so the fielded mon can never complete its set and the competitive
// spread describes the future hatch. The readiness marks it, the optimizer
// and the pane price the mon on its own best attacks instead of that spread,
// and the card says so.
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTeamAnalysisPanel } from '../src/teamBuilder/team-analysis-view.js';
import { buildTeamAnalysis } from '../src/teamBuilder/team-analysis.js';
import { bestChoice, progressionAt, runPool } from './helpers/harness.mjs';

// The reporting gamestate's progression at badge 2, cap 35, daycare open:
// Facade by TM, no Boomburst parent anywhere.
const progression = {
  ...progressionAt({ badge: 2, levelCap: 35 }),
  daycareUnlocked: true,
  availableTmIds: [
    'tm60', 'tm54', 'tm42', 'tm45', 'tm90', 'tm63', 'tm57', 'tm20', 'tm69',
    'tm07', 'tm21', 'tm17', 'tm46', 'tm56', 'tm96', 'tm100', 'tm77',
  ],
  availableTmxIds: ['tmx1', 'tmx7'],
};

test('Swellow is interim while Boomburst needs a re-bred Taillow', async () => {
  const result = await runPool({ pool: ['Taillow'], progression });
  const choice = bestChoice(result, 'Taillow');
  const profile = choice.legalityProfile;
  const readiness = profile.setReadiness;
  assert.equal(readiness.needsRebreed, true);
  const boomburst = readiness.moves.find((move) => move.id === 'boomburst');
  assert.equal(boomburst.eggOnly, true);
  assert.equal(boomburst.status, 'later');

  // Priced on its own best attacks: physical, with the stopgap set fielded,
  // not the Timid 252 SpA spread of the Swellow it is not.
  const facade = profile.recommendedMoves.find((move) => move.id === 'facade');
  assert.ok(facade, profile.recommendedMoves.map((move) => move.id));
  assert.match(facade.damageSteps.join('\n'), /nature in Atk/);
  assert.equal(profile.investmentSide, 'physical');
  assert.notEqual(choice.buildKey, 'utility');
});

test('the card shows the physical build the interim Swellow was priced as', async () => {
  const result = await runPool({ pool: ['Taillow'], progression });
  const analysis = await buildTeamAnalysis(
    result.team, progression, { family: 'singles', selection: 'all' });
  const set = analysis.profiles[0].recommendedSet;
  // Timid 0/0/0/252/4/252 mirrored: Jolly with the attacking EVs swapped.
  assert.equal(set.nature, 'Jolly');
  assert.deepEqual(set.evs, [0, 252, 0, 0, 4, 252]);
});

test('a donor that supplies the egg move makes the hatch the plan, not interim', async () => {
  const at45 = {
    ...progressionAt({ badge: 5, levelCap: 45 }), daycareUnlocked: true,
  };
  const alone = await runPool({ pool: ['Dodrio'], progression: at45 });
  assert.equal(
    bestChoice(alone, 'Dodrio').legalityProfile.setReadiness.needsRebreed, true);
  const bred = await runPool({
    pool: ['Dodrio'], donorPool: ['Staraptor'], progression: at45,
  });
  assert.equal(
    bestChoice(bred, 'Dodrio').legalityProfile.setReadiness.needsRebreed, false);
});

test('the card says the final set is a re-bred one', async () => {
  const result = await runPool({ pool: ['Taillow'], progression });
  const root = {
    innerHTML: '',
    isConnected: true,
    ownerDocument: { querySelectorAll: () => [] },
  };
  await renderTeamAnalysisPanel(root, {
    family: 'singles',
    selection: 'all',
    poolQuery: 'Taillow',
    progression,
    itemAssignments: {},
    team: result.team,
  });
  assert.match(root.innerHTML, /team-set-interim/);
  assert.match(root.innerHTML, /re-bred Taillow hatched with Boomburst/);
});
