// The site serves one slice of the usage data, every month aggregated: the
// Usage Data and Set Lookup pages offer no month picker, the URL state
// carries no month, and the monthly moveset files are build inputs that no
// deployment ships (deploy.yml leaves them out beside the raw sources).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { renderControls } = await import('../src/views/controls-view.js');
const { renderResolverControls } = await import(
  '../src/views/resolver-controls-view.js',
);
const { DEFAULT_STATE } = await import('../src/state.js');

test('the usage pages render no month picker and the state holds no month', () => {
  const formats = [{ id: 'gen7ou', label: 'OU', family: 'singles' }];
  const state = { ...DEFAULT_STATE, family: 'singles', format: 'gen7ou' };
  const controls = { innerHTML: '' };
  renderControls(controls, state, formats);
  assert.ok(controls.innerHTML.includes('id="format-select"'));
  assert.ok(!/month/i.test(controls.innerHTML));
  const resolver = { innerHTML: '' };
  renderResolverControls(resolver, state);
  assert.ok(resolver.innerHTML.includes('id="resolver-query-input"'));
  assert.ok(!/month|period/i.test(resolver.innerHTML));
  assert.ok(!('month' in DEFAULT_STATE));
  assert.ok(!('resolverMonth' in DEFAULT_STATE));
});

test('a deployment leaves the monthly moveset files out beside the sources', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/deploy.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /DEPLOY_EXCLUDE_DATA: sources,movesets/);
});
