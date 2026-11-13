// What the Sets & coverage panel says beyond its text: its structure for a
// screen reader (a heading per card, moves as a list, real tables) and the
// few places colour carries a verdict. A design review found each card
// read as one run-on sentence, every card's readiness line in the caution
// colour whatever its state, and items named that the player could not
// have yet.
import assert from 'node:assert/strict';
import test from 'node:test';

import { renderTeamAnalysisPanel } from '../src/teamBuilder/team-analysis-view.js';
import { buildTeamAnalysis } from '../src/teamBuilder/team-analysis.js';
import { progressionAt, runPool } from './helpers/harness.mjs';

const { itemAheadBadge } = await import(
  '../src/playthrough/set-readiness.js',
);
const { getItemUnlockBadge } = await import('../src/games/items.js');

const progression = progressionAt({ badge: 2, levelCap: 35 });
const POOL = ['Taillow', 'Mareep', 'Budew'];

async function renderPanel() {
  const result = await runPool({ pool: POOL, progression });
  const root = { innerHTML: '', isConnected: true, querySelectorAll: () => [] };
  await renderTeamAnalysisPanel(root, {
    family: 'singles',
    selection: 'all',
    poolQuery: POOL.join(', '),
    progression,
    itemAssignments: {},
    team: result.team,
  });
  const analysis = await buildTeamAnalysis(
    result.team, progression, { family: 'singles' });
  return { html: root.innerHTML, analysis };
}

test('an item is ahead of the player until its badge, unless they hold one', () => {
  const badge = getItemUnlockBadge('leftovers');
  assert.ok(badge > 1, 'Leftovers come after the first badge');
  const at = (badges, ownedItems = {}) =>
    itemAheadBadge('Leftovers', { checkpoint: `badge-${badges}`, ownedItems });
  assert.equal(at(badge - 1), badge);
  assert.equal(at(badge), null);
  assert.equal(at(badge - 1, { leftovers: 1 }), null);
  // No badge count to compare with, or no item at all: nothing to say.
  assert.equal(itemAheadBadge('Leftovers', {}), null);
  assert.equal(itemAheadBadge(null, { checkpoint: 'badge-1' }), null);
});

test('a set card is a heading, a list of moves and a plain readiness line', async () => {
  const { html, analysis } = await renderPanel();
  for (const profile of analysis.profiles) {
    assert.ok(
      html.includes(`<h4>${profile.currentName}</h4>`), profile.currentName);
  }
  const moves = analysis.profiles.flatMap((p) => p.recommendedMoves);
  // The real team's cards, below, list their moves the same way.
  const [ownCards] = html.split('class="team-real-team');
  assert.equal(
    ownCards.split('<li class="team-set-move">').length - 1, moves.length);
  // A status move deals no damage by design and says so.
  assert.ok(moves.some((move) => move.category === 'Status'));
  assert.ok(!html.includes('>0 dmg'));
  assert.match(html, /team-set-move-dmg"[^>]*>status</);

  // An item named before the player can have it carries its badge.
  const ahead = analysis.profiles
    .map((profile) => profile.recommendedSet)
    .filter((set) => set.itemAheadBadge != null);
  assert.ok(ahead.length, 'at two badges some set item is still ahead');
  for (const set of ahead) {
    assert.match(html, new RegExp(
      `team-set-ahead"[^>]*>${set.item} \\(${set.itemAheadBadge} badges?\\)`));
  }

  // Only a pickup the player can make today is marked on the line.
  const pending = analysis.profiles.filter(
    (profile) => profile.setReadiness?.pendingPickups).length;
  assert.equal(html.split('class="team-set-pending"').length - 1, pending);
  assert.ok(!html.includes('is-complete'));
});

test('the tiles colour a verdict, and the row lists are tables', async () => {
  const { html } = await renderPanel();
  // Three tiles judge; the count of shared weaknesses does not.
  const tones = html.match(/<strong class="is-(ok|warn)">/g) || [];
  assert.equal(tones.length, 3);
  for (const label of ['Shared weaknesses', 'Resists and immunities']) {
    if (!html.includes(`aria-label="${label}"`)) continue;
    // The cells say what they are, so the column names are for a screen
    // reader only.
    assert.match(html, new RegExp(
      `aria-label="${label}">\\s*<thead role="rowgroup" class="visually-hidden">`));
  }
  assert.match(
    html,
    /aria-label="Thinnest super-effective answers">\s*<thead role="rowgroup">/);
  assert.match(html, /<th role="columnheader" scope="col">Damage<\/th>/);
  assert.ok(!html.includes('team-analysis-row'));
});
