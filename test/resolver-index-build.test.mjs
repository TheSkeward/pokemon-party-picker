// The resolver index builder's usage rule (SCORING.md, Usage trust), run on
// fixture tiers: the headline tier, the first tier clearing the meaningful
// bar, the stepped trace for mons below it everywhere, and the line signals
// that ignore LC and NFE.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAllPokemonUsage } from '../scripts/build-resolver-index.mjs';

const availability = {
  familyConfigs: {
    singles: {
      formatOrder: ['gen7ou', 'gen7uu', 'gen7lc'],
      cutoffPriority: [1695],
    },
  },
  months: {
    '2026-08': {
      gen7ou: { usage: [1695] },
      gen7uu: { usage: [1695] },
      gen7lc: { usage: [1695] },
    },
  },
};

// Usage percent per tier. The meaningful bar is 2.73% (25 games); 2.0%
// qualifies at 35 games, 2.1% also at 35, 1.2% only at 60.
const usage = {
  gen7ou: { ranked: 5, stepped: 1.2, tied: 2.0, babyline: 2.0, headline: 0.5 },
  gen7uu: { stepped: 2.0, tied: 2.1, headline: 4 },
  gen7lc: { babyline: 10 },
};

const readSource = async (month, formatId) => ({
  pokemon: Object.fromEntries(
    Object.entries(usage[formatId] || {}).map(([id, value]) => [
      id,
      { name: id, usage: value, rawCount: 10 },
    ]),
  ),
});

test('the builder applies the stepped usage rule and keeps line signals apart', async () => {
  const index = await resolveAllPokemonUsage(availability, 'singles', readSource);

  // Meaningful at the first tier: ranked there, and no trace is kept.
  assert.equal(index.ranking.ranked.formatId, 'gen7ou');
  assert.equal(index.trace.ranked, undefined);

  // Below the bar everywhere: the shortest horizon wins over tier priority.
  assert.equal(index.trace.stepped.formatId, 'gen7uu');
  assert.equal(index.ranking.stepped, undefined);

  // The same horizon: the earlier tier wins over the larger usage.
  assert.equal(index.trace.tied.formatId, 'gen7ou');

  // The headline is the first tier the mon appears in, bar or no bar; the
  // rank is the first tier that clears it, and ranking deletes the trace.
  assert.equal(index.resolved.headline.formatId, 'gen7ou');
  assert.equal(index.ranking.headline.formatId, 'gen7uu');
  assert.equal(index.trace.headline, undefined);

  // An LC rank supplies the set but never the line, which keeps its OU trace.
  assert.equal(index.ranking.babyline.formatId, 'gen7lc');
  assert.equal(index.lineRanking.babyline, undefined);
  assert.equal(index.lineTrace.babyline.formatId, 'gen7ou');
});
