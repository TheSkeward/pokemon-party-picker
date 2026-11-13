// How an install's files reach the extractor's readers
// (scripts/essentials/game-files.mjs): parsed Marshal data made plain, Ruby
// sources found in and cited by line, and the text helpers every script
// rule is picked apart with. A slip here moves every extract at once.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GameInstall,
  numbersIn,
  RubySymbol,
  splitArgs,
  symbolsIn,
  toPlain,
} from '../scripts/essentials/game-files.mjs';
import {
  removeInstall,
  rubyObject,
  rubySource,
  rubyString,
  symbol,
  writeInstall,
} from './helpers/essentials-files.mjs';

test('plain data is strings, numbers and records named without the @', () => {
  const species = rubyObject('MonData', {
    name: rubyString('Flabébé'),
    flags: new Map([[symbol('WildItemCommon'), symbol('ORANBERRY')]]),
    weight: { rubyFloat: 0.1 },
    sprite: { rubyUserdef: 'Table', raw: Buffer.alloc(2) },
    moves: [symbol('TACKLE'), 5, true, null],
  });
  assert.deepEqual(toPlain(species), {
    // The game files are UTF-8, which the reader left as bytes.
    name: 'Flabébé',
    flags: new Map([['WildItemCommon', 'ORANBERRY']]),
    weight: 0.1,
    // What a class dumps for itself is not read.
    sprite: null,
    moves: ['TACKLE', 5, true, null],
  });
});

test('a hash stays a Map, its integer keys integers, in its order', () => {
  const table = new Map([
    [3, rubyString('c')], [1, rubyString('a')], [symbol('x'), symbol('y')],
  ]);
  assert.deepEqual([...toPlain(table)], [[3, 'c'], [1, 'a'], ['x', 'y']]);
});

test('a pointer back at what holds it is null; a shared value is not', () => {
  // A form points at the species it is a form of.
  const base = rubyObject('MonData', { name: rubyString('Deerling') });
  const form = rubyObject('MonData', { base, seasons: new Map([[0, base]]) });
  base.ivars.set('@forms', [form]);
  assert.deepEqual(toPlain(base), {
    name: 'Deerling',
    forms: [{ base: null, seasons: new Map([[0, null]]) }],
  });
  // The same list in two places leads back to nothing: both are kept.
  const shared = [symbol('LandDay')];
  assert.deepEqual(toPlain([shared, shared]), [['LandDay'], ['LandDay']]);
});

test('a script text gives up its symbols, numbers and arguments', () => {
  assert.deepEqual(
    symbolsIn('stock = [:POTION, :SUPER_REPEL,\n  :TM01]'),
    ['POTION', 'SUPER_REPEL', 'TM01']);
  assert.deepEqual(numbersIn('chances = [50, 5, -1]'), [50, 5, -1]);
  // Only a comma outside brackets and quotes parts two arguments.
  assert.deepEqual(
    splitArgs(':POTION, pbGet(1, 2) ,"Hi, there", [3, 4], {a: 1, b: 2}'),
    [':POTION', 'pbGet(1, 2)', '"Hi, there"', '[3, 4]', '{a: 1, b: 2}']);
  assert.deepEqual(splitArgs(''), []);
});

test('a source finds a line from a given line on, and cites it', () => {
  const source = rubySource([
    'chances = [1]',
    'def pbPickup',
    '  chances = [50, 5]',
    'end',
  ], 'Scripts/Field.rb');
  const first = source.find(/chances = \[([\d, ]+)\]/);
  assert.equal(first.line, 1);
  assert.equal(first.match[1], '1');
  // The line searched from is itself searched.
  assert.equal(source.find(/chances/, 2).line, 3);
  assert.equal(source.find(/chances/, 3).line, 3);
  assert.equal(source.text(2, 3), 'def pbPickup\n  chances = [50, 5]');
  assert.deepEqual(source.cite(3), { file: 'Scripts/Field.rb', line: 3 });
  assert.deepEqual(
    source.cite(2, 4), { file: 'Scripts/Field.rb', line: 2, endLine: 4 });
  // A rule that has moved or gone fails rather than reading as empty.
  assert.throws(
    () => source.find(/chances/, 4),
    /Scripts\/Field\.rb: no line matches \/chances\/ from 4/);
});

test('a source with Windows line ends has no stray carriage returns', () => {
  const source = rubySource(['chance = 5 + level\r', 'end\r', '']);
  assert.equal(source.find(/chance = (.*)$/).match[1], '5 + level');
  assert.equal(source.find(/^end$/).line, 2);
});

test('an install reads its Data files, and its maps in id order', (t) => {
  // Each file here is one value: an integer, or the symbol :a.
  const integer = (n) => Buffer.from([4, 8, 0x69, n + 5]);
  const dir = writeInstall({
    'Data/Map010.rxdata': integer(10),
    'Data/Map002.rxdata': integer(2),
    // Not maps: the map list, and a map's backup.
    'Data/MapInfos.rxdata': integer(99),
    'Data/Map002.rxdata.bak': integer(98),
    'Data/items.dat': Buffer.from([4, 8, 0x3a, 6, 0x61]),
    'Scripts/Rules.rb': 'VERSION = 1\n',
  });
  t.after(() => removeInstall(dir));
  const install = new GameInstall(dir);
  assert.deepEqual([...install.maps()], [
    { mapId: 2, map: 2 }, { mapId: 10, map: 10 },
  ]);
  // Parsed keeps the symbol a symbol; loaded is plain.
  assert.ok(install.parse('items.dat') instanceof RubySymbol);
  assert.equal(install.load('items.dat'), 'a');
  assert.equal(install.source('Scripts/Rules.rb').find(/VERSION/).line, 1);
});
