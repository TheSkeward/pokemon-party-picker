import assert from 'node:assert/strict';
import test from 'node:test';

import { renderTeamAnalysisPanel } from '../src/teamBuilder/team-analysis-view.js';
import { teamMemberKey } from '../src/teamBuilder/item-recommendations.js';
import { runPool } from './helpers/harness.mjs';

function displayedSet(html, pokemonId) {
  const cards = [...html.matchAll(
    /<div class="team-set-card ([^"]*)" data-set-card="([^"]+)">([\s\S]*?)<div class="team-set-foot">/g,
  )];
  const card = cards.find((match) => match[2] === pokemonId);
  assert.ok(card, `missing ${pokemonId} card`);
  return {
    warning: card[1].includes('warning'),
    moves: [...card[3].matchAll(
      /class="team-set-move-name"[^>]*>([^<]+)<\/span>/g,
    )].map((match) => match[1]),
  };
}

test('Cut removal refreshes realized moves even when the team and build keys stay the same', async () => {
  const pool = ['Patrat', 'Purrloin', 'Stunky'];
  const progression = {
    checkpoint: 'badge-1',
    levelCap: '25',
    moveRelearnerUnlocked: false,
    daycareUnlocked: false,
    availableTmIds: ['tm57'],
    availableTmxIds: [],
    availableTutorMoveIds: [],
    ownedItems: { pokeball: 6 },
  };
  const before = await runPool({
    pool,
    progression: { ...progression, availableTmxIds: ['tmx1'] },
  });
  const after = await runPool({ pool, progression });
  const buildKeys = (result) => result.team.map(
    (row) => `${row.pokemonId}|${row.buildKey}`,
  );
  assert.deepEqual(buildKeys(after), buildKeys(before));
  for (const row of before.team) {
    assert.ok(row.legalityProfile.recommendedMoves.some((move) => move.id === 'cut'));
  }

  const root = {
    innerHTML: '',
    isConnected: true,
    ownerDocument: { querySelectorAll: () => [] },
  };
  const options = {
    family: 'singles',
    selection: 'all',
    poolQuery: pool.join('\n'),
    progression,
    itemAssignments: Object.fromEntries(before.team.map((row) => [
      teamMemberKey(row), { name: 'Poke Ball' },
    ])),
  };

  // The loading render still has the old team but the new progression.
  await renderTeamAnalysisPanel(root, { ...options, team: before.team });
  for (const id of ['watchog', 'liepard', 'stunky']) {
    assert.equal(displayedSet(root.innerHTML, id).moves.length, 3);
  }
  assert.equal(displayedSet(root.innerHTML, 'watchog').warning, true);

  // Completion keeps the same species/build labels, but replaces Cut.
  await renderTeamAnalysisPanel(root, { ...options, team: after.team });
  const expected = {
    watchog: ['Hypnosis', 'Super Fang', 'Crunch', 'Tackle'],
    liepard: ['Pursuit', 'Fury Swipes', 'Fake Out', 'Hone Claws'],
    stunky: ['Bite', 'Slash', 'Fury Swipes', 'Acid Spray'],
  };
  for (const [id, moves] of Object.entries(expected)) {
    const shown = displayedSet(root.innerHTML, id);
    assert.deepEqual(shown.moves, moves, id);
    assert.equal(shown.warning, false, id);
  }

  // Ordinary repeated renders still reuse the settled analysis, without
  // flashing the loading placeholder (including equivalent cloned rows).
  const settledHtml = root.innerHTML;
  const repeated = renderTeamAnalysisPanel(root, {
    ...options,
    team: structuredClone(after.team),
  });
  assert.equal(root.innerHTML, settledHtml);
  await repeated;
  assert.equal(root.innerHTML, settledHtml);
});
