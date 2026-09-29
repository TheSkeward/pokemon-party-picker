import assert from 'node:assert/strict';
import test from 'node:test';

import { renderTeamAnalysisPanel } from '../src/teamBuilder/team-analysis-view.js';
import { isFixedDamageMove } from '../src/teamBuilder/damage-model.js';
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
  // Cut seats only where it out-hits the rest of the set somewhere (Liepard
  // here; Watchog's Super Fang beats a level-25 Cut into every type).
  const carriesCut = (row) =>
    row.legalityProfile.recommendedMoves.some((move) => move.id === 'cut');
  // Cards are keyed by the fielded form (Stunky at cap 25, not Skuntank).
  const cardId = (row) => row.legalityProfile.fieldedId || row.pokemonId;
  const cutCarriers = before.team.filter(carriesCut).map(cardId);
  assert.ok(cutCarriers.length >= 1, 'Cut must seat on someone');
  for (const row of after.team) assert.ok(!carriesCut(row), cardId(row));

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

  // The loading render still has the old team but the new progression: the
  // members that carried Cut show it dropped, the rest are untouched.
  await renderTeamAnalysisPanel(root, { ...options, team: before.team });
  for (const row of before.team) {
    const shown = displayedSet(root.innerHTML, cardId(row));
    const expectedLength = cutCarriers.includes(cardId(row)) ? 3 : 4;
    assert.equal(shown.moves.length, expectedLength, cardId(row));
  }

  // Completion keeps the same species/build labels, but shows the sets
  // re-optimized without Cut.
  await renderTeamAnalysisPanel(root, { ...options, team: after.team });
  for (const row of after.team) {
    const shown = displayedSet(root.innerHTML, cardId(row));
    assert.deepEqual(
      shown.moves,
      row.legalityProfile.recommendedMoves.map((move) => move.name),
      cardId(row),
    );
    assert.ok(!shown.moves.includes('Cut'), cardId(row));
    // The card warns when the SHOWN set carries no STAB attack (Watchog's
    // real set is Hypnosis, Super Fang, Crunch, Confuse Ray, and warns).
    const hasStab = row.legalityProfile.recommendedMoves.some(
      (move) =>
        move.category !== 'Status' &&
        !isFixedDamageMove(move.id) &&
        row.legalityProfile.currentTypes.includes(move.type),
    );
    assert.equal(shown.warning, !hasStab, cardId(row));
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
