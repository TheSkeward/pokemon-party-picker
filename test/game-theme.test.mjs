// Each game's palette is its own and readable: every text, state, and
// accent color clears WCAG AA on both of the game's surfaces, the shared
// fills carry the game's ink at AA, the stylesheet defaults are the default
// game's, and activating a game sets every token.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { listGames } from '../src/games/registry.js';
import { applyGameTheme, themeProperties } from '../src/app/theme.js';
import {
  badgeStyle,
  getCategoryColor,
  getTypeColor,
  listTypeNames,
} from '../src/move-meta.js';

const css = fs.readFileSync(path.resolve('src', 'styles', 'main.css'), 'utf8');
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('\n}\n'));
const token = (name) =>
  rootBlock.match(new RegExp(`${name}: (#[0-9a-f]{6}|dark|light)`))[1];
const sharedFills = [...rootBlock.matchAll(/--fill-(?!ink)[a-z]+:\s*(#[0-9a-f]{6})/g)]
  .map((match) => match[1]);

function luminance(hex) {
  const channel = (index) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}
const assertAA = (fg, bg, label) =>
  assert.ok(contrast(fg, bg) >= 4.5, `${label}: ${fg} fails AA on ${bg}`);

test('every game palette is complete, hex, and readable at AA', () => {
  assert.ok(sharedFills.length >= 4, 'shared fills present in the stylesheet');
  for (const game of listGames()) {
    const { scheme, shell, states, accents } = game.theme;
    assert.ok(['dark', 'light'].includes(scheme), `${game.id} scheme`);
    const text = {
      text: shell.text,
      textMuted: shell.textMuted,
      ...states,
      ...Object.fromEntries(accents.map((a) => [a.name, a.color])),
    };
    for (const color of [shell.base, shell.surface, shell.hairline, shell.ink,
      ...Object.values(text)]) {
      assert.match(color, /^#[0-9a-f]{6}$/, `${game.id} ${color}`);
    }
    for (const [role, color] of Object.entries(text)) {
      assertAA(color, shell.base, `${game.id} ${role}`);
      assertAA(color, shell.surface, `${game.id} ${role}`);
    }
    for (const fill of sharedFills) assertAA(shell.ink, fill, `${game.id} ink`);
    assert.equal(accents.length, 4, game.id);
    assert.equal(new Set(accents.map((a) => a.color)).size, 4, game.id);
    // Panels sit lighter than the ground in either scheme, so they read as
    // raised.
    assert.ok(
      luminance(shell.surface) > luminance(shell.base),
      `${game.id} surface lift`,
    );
  }
});

test('every type and category badge reads at AA with the ink it picks', () => {
  const inks = {
    light: token('--badge-ink-light'),
    dark: token('--badge-ink-dark'),
  };
  const fills = [
    ...listTypeNames().map(getTypeColor),
    ...['Physical', 'Special', 'Status', 'Unknown'].map(getCategoryColor),
  ];
  for (const fill of fills) {
    const ink = badgeStyle(fill).match(/--badge-ink-(light|dark)/)[1];
    assertAA(inks[ink], fill.toLowerCase(), `badge ${fill} with ${ink} ink`);
  }
});

test('the stylesheet defaults are the default game palette', () => {
  const reborn = listGames().find((game) => game.id === 'reborn');
  for (const [property, value] of themeProperties(reborn.theme)) {
    assert.equal(token(property), value, property);
  }
});

test('applying a theme sets every token and the scheme on the root', () => {
  const set = [];
  const root = {
    style: { setProperty: (name, value) => set.push([name, value]) },
  };
  const hgss = listGames().find((game) => game.id === 'hgss');
  applyGameTheme(hgss, root);
  assert.deepEqual(set, themeProperties(hgss.theme));
  assert.ok(set.some(
    ([name, value]) => name === 'color-scheme' && value === 'light',
  ));
  assert.equal(set.length, 14);
});
