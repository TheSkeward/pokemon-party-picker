// Every game supplies four accent hues, and each clears WCAG AA for small
// text on the shared surface color, as the token block promises.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { listGames } from '../src/games/registry.js';
import { applyGameTheme } from '../src/app/theme.js';

const css = fs.readFileSync(path.resolve('src', 'styles', 'main.css'), 'utf8');
const token = (name) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`))[1];

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

test('each game has four distinct accents readable on the surface', () => {
  const surface = token('bg-surface');
  for (const game of listGames()) {
    const accents = game.theme.accents;
    assert.equal(accents.length, 4, game.id);
    const distinct = new Set(accents.map((accent) => accent.color));
    assert.equal(distinct.size, 4, game.id);
    for (const accent of accents) {
      assert.match(accent.color, /^#[0-9a-f]{6}$/, `${game.id} ${accent.name}`);
      assert.ok(
        contrast(accent.color, surface) >= 4.5,
        `${game.id} ${accent.name} ${accent.color} fails AA on ${surface}`,
      );
    }
  }
});

test('the stylesheet defaults are the default game accents', () => {
  const reborn = listGames().find((game) => game.id === 'reborn');
  reborn.theme.accents.forEach((accent, index) => {
    assert.equal(token(`accent-${index + 1}`), accent.color);
  });
});

test('applying a theme sets the four slot tokens on the root', () => {
  const set = new Map();
  const root = {
    style: { setProperty: (name, value) => set.set(name, value) },
  };
  const hgss = listGames().find((game) => game.id === 'hgss');
  applyGameTheme(hgss, root);
  assert.deepEqual(
    [...set.entries()],
    hgss.theme.accents.map((accent, index) => [
      `--accent-${index + 1}`,
      accent.color,
    ]),
  );
});
