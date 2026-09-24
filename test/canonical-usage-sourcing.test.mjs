import assert from 'node:assert/strict';
import test from 'node:test';
import { compareTraceUsage, gamesToLikelySee } from '../src/teamBuilder/trace-usage.js';
import {
  getCanonicalLineCandidates,
  getLineUsageOrder,
  isLineUsageFormat,
} from '../src/teamBuilder/usage-line-ranking.js';
import { stitchPokemonSetDetail } from '../scripts/set-index/stitch-set-details.mjs';

const row = (id, tierRank, value, extra = {}) => ({
  candidate: { id, name: id, isMega: false, ...extra },
  bundle: { trace: { tierRank, value, formatId: `tier${tierRank}`, cutoff: 0 } },
});

test('same relaxation step favors tier priority over the largest usage', () => {
  const high = row('high', 0, 2.0);
  const low = row('low', 6, 2.2);
  assert.equal(gamesToLikelySee(2.0), 35);
  assert.equal(gamesToLikelySee(2.2), 35);
  assert.ok(compareTraceUsage(high.bundle.trace, low.bundle.trace) < 0);
  const candidates = [low, high];
  assert.equal(getLineUsageOrder(candidates).trace.pokemonId, 'high');
  assert.equal(getCanonicalLineCandidates(candidates)[0].candidate.id, 'high');
});

test('an earlier successful step beats a higher tier needing another step', () => {
  const rows = [row('high', 0, 2.0), row('low', 6, 2.4)];
  assert.equal(getCanonicalLineCandidates(rows)[0].candidate.id, 'low');
  assert.equal(getLineUsageOrder(rows).trace.games, 30);
});

test('usage breaks ties within a tier; zero/absent signals cannot qualify', () => {
  assert.ok(compareTraceUsage({ tierRank: 0, value: 2.2 },
    { tierRank: 0, value: 2.0 }) < 0);
  assert.ok(compareTraceUsage(null, { tierRank: 0, value: 0.001 }) > 0);
  assert.equal(compareTraceUsage({ value: 0 }, null), 0);
});

test('every exact five-game cutoff is inclusive', () => {
  for (const games of [30, 35, 40, 70, 100, 235, 1000]) {
    const cutoff = 100 * (1 - 0.5 ** (1 / games));
    assert.equal(gamesToLikelySee(cutoff), games);
    assert.equal(gamesToLikelySee(cutoff - 1e-9), games + 5);
  }
});

test('Rattata stays canonical instead of a higher-scoring Raticate', () => {
  const rattata = { ...row('rattata', 3, 2.035246486486487), score: 10 };
  const raticate = { ...row('raticate', 30, 1.9535422727272727), score: 1000 };
  const canonical = getCanonicalLineCandidates([raticate, rattata]);
  assert.deepEqual(canonical.map((entry) => entry.candidate.id), ['rattata']);
});

test('meaningful ranks precede trace and retain a canonical non-Mega fallback', () => {
  const mega = row('mega', 0, 0, { isMega: true });
  mega.bundle = { ranking: { tierRank: 4, value: 3 } };
  const high = row('high', 0, 2.0);
  const low = row('low', 6, 2.2);
  assert.deepEqual(getCanonicalLineCandidates([low, high, mega])
    .map((entry) => entry.candidate.id), ['mega', 'high']);
  const absent = [{ candidate: { id: 'absent' }, bundle: {}, score: 1 }];
  assert.equal(getCanonicalLineCandidates(absent), absent);
});

test('LC and NFE cannot nominate the line representative', () => {
  assert.equal(isLineUsageFormat('gen7lc'), false);
  assert.equal(isLineUsageFormat('gen7nfe'), false);
  assert.equal(isLineUsageFormat('gen7anythinggoes'), true);
  const lc = row('baby', 0, 20);
  lc.bundle = { ranking: { tierRank: 0, formatId: 'gen7lc', value: 20 } };
  const nfe = row('middle', 0, 2.7);
  nfe.bundle.trace.formatId = 'gen7nfe';
  const adult = row('adult', 30, 1.9);
  assert.deepEqual(getCanonicalLineCandidates([lc, nfe, adult])
    .map((entry) => entry.candidate.id), ['adult']);
});

test('an LC set source does not hide admissible evidence for form selection', () => {
  const baby = row('baby', 3, 2.0);
  baby.bundle = {
    ranking: { tierRank: 39, formatId: 'gen7lc', value: 20 },
    trace: null,
    lineRanking: null,
    lineTrace: { tierRank: 3, formatId: 'gen7anythinggoes', value: 2.0 },
  };
  const adult = row('adult', 30, 2.1);
  assert.equal(getCanonicalLineCandidates([adult, baby])[0].candidate.id, 'baby');
  baby.bundle.lineTrace = null;
  assert.equal(getCanonicalLineCandidates([baby, adult])[0].candidate.id, 'adult');
});

test('set stitching uses the relaxed higher-tier source as primary', () => {
  const traces = [
    { tierRank: 6, formatId: 'low', cutoff: 0, value: 2.2 },
    { tierRank: 0, formatId: 'high', cutoff: 0, value: 2.0 },
  ];
  const trace = [...traces].sort(compareTraceUsage)[0];
  const sourceAggregates = traces.map((source) => ({
    aggregateByPokemon: new Map([['example', {
      ...source, family: 'singles', selection: 'all',
      monthsAvailable: 1, monthsPresent: 1,
      entry: { name: 'Example', moves: [{ name: source.formatId, usage: 90 }],
        items: [], abilities: [], spreads: [] },
    }]]),
  }));
  const detail = stitchPokemonSetDetail({
    family: 'singles', formatsIndex: [], pokemon: { id: 'example' },
    ranking: null, trace, selection: 'all', sourceAggregates,
  });
  assert.equal(detail.primarySource.formatId, 'high');
  assert.equal(detail.moves[0].name, 'high');
});

test('monthly resolution uses stepped fallback and preserves canonical facts', async () => {
  globalThis.__ENV__ ??= { BASE_URL: '/' };
  const { resolveRepresentativeLightBundle } = await import(
    '../src/teamBuilder/representative-bundle.js',
  );
  const fetchBefore = globalThis.fetch;
  const canonicalTrace = { tierRank: 0, formatId: 'high', cutoff: 0, value: 2 };
  globalThis.fetch = async (url) => {
    const path = String(url);
    const data = path.includes('resolver-index')
      ? { pokemon: { example: { trace: canonicalTrace } } }
      : path.includes('/usage.json')
        ? { pokemon: { example: { name: 'Example', rawCount: 100,
          usage: path.includes('/high/') ? 2.0 : 2.2 } } }
        : { pokemon: {}, summary: {} };
    return { ok: true, json: async () => data };
  };
  try {
    const result = await resolveRepresentativeLightBundle({
      family: 'test-stepped', pokemonId: 'example', selection: '2026-01',
      minMeaningfulUsagePercent: 100 * (1 - 0.5 ** (1 / 25)),
      availability: {
        familyConfigs: { 'test-stepped': {
          formatOrder: ['high', 'low'], cutoffPriority: [0],
        } },
        months: { '2026-01': {
          high: { usage: [0], leads: [0] },
          low: { usage: [0], leads: [0] },
        } },
      },
    });
    assert.equal(result.usage.formatId, 'high');
    assert.equal(result.usage.value, 2);
    assert.deepEqual(result.trace, canonicalTrace);
    assert.equal(result.ranking, null);
  } finally {
    globalThis.fetch = fetchBefore;
  }
});
