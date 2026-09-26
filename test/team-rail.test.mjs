// The sticky team rail: the current team's names as jumps to their set cards
// plus the page's section links, rendered with or without a result.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__ENV__ ??= { BASE_URL: '/' };
const { renderTeamRail } = await import(
  '../src/teamBuilder/team-builder-view.js',
);

const choice = (inputPokemonId, pokemonId, name, score) => ({
  inputPokemonId, pokemonId, name, score, bundle: {},
});

test('the rail names the team in table order and links every section', () => {
  const html = renderTeamRail({
    result: {
      team: [
        choice('gengar', 'gengar', 'Gengar', 900),
        choice('eevee', 'espeon', 'Espeon', 1200),
      ],
      lines: [],
    },
    teamSort: 'score',
    teamSortDir: 'desc',
    progression: { levelCap: '100' },
    resultProgressionStale: false,
  });
  const picks = [...html.matchAll(/class="team-rail-pick"[^>]*>([^<]+)</g)]
    .map((match) => match[1]);
  assert.deepEqual(picks, ['Espeon', 'Gengar']);
  assert.ok(html.includes('data-jump-set-card="espeon"'));
  for (const anchor of ['#team', '#pool', '#bench', '#reborn-team-analysis-root', '#progression']) {
    assert.ok(html.includes(`href="${anchor}"`), anchor);
  }
  assert.ok(!html.includes('data-stale'));
});

test('without a result the rail still renders, so the page never jumps', () => {
  const html = renderTeamRail({ result: null, progression: {} });
  assert.ok(html.includes('team-rail'));
  assert.ok(html.includes('not optimized yet'));
  assert.ok(!html.includes('class="team-rail-pick"'));
});

test('a stale result dims the rail', () => {
  const html = renderTeamRail({
    result: { team: [choice('gengar', 'gengar', 'Gengar', 1)], lines: [] },
    teamSort: 'score',
    teamSortDir: 'desc',
    progression: {},
    resultProgressionStale: true,
  });
  assert.ok(html.includes('data-stale'));
});
