// The Ruby Marshal reader (scripts/essentials/parse-marshal.mjs), on
// payloads written out byte by byte. Every compiled Data file the extracts
// are built from goes through it, so a misread integer or back-reference
// changes generated data without failing anything.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseMarshal,
  RubyObject,
  RubySymbol,
} from '../scripts/essentials/parse-marshal.mjs';

// The payload of the pieces given, after the version header: text stands
// for its bytes and a number for one byte.
const read = (...pieces) => parseMarshal(Buffer.concat([
  Buffer.from([4, 8]),
  ...pieces.flat(Infinity).map((piece) => (typeof piece === 'number'
    ? Buffer.from([piece])
    : Buffer.from(piece, 'latin1'))),
]));
// A length, a count or an index under 123 is stored as itself plus 5, and
// zero as zero.
const count = (n) => (n === 0 ? 0 : n + 5);
const symbol = (name) => [':', count(name.length), name];
const string = (text) => ['"', count(text.length), text];
const integer = (n) => ['i', count(n)];

test('only a Marshal 4 payload, up to 4.8, is read', () => {
  assert.equal(parseMarshal(Buffer.from([4, 8, 0x30])), null);
  assert.throws(
    () => parseMarshal(Buffer.from([3, 0, 0x30])),
    /Unsupported Marshal version 3\.0/);
  assert.throws(
    () => parseMarshal(Buffer.from([4, 9, 0x30])),
    /Unsupported Marshal version 4\.9/);
});

test('nil, true and false are null and the booleans', () => {
  assert.deepEqual(read('[', count(3), '0', 'T', 'F'), [null, true, false]);
});

test('an integer from -123 to 122 is one byte', () => {
  const cases = [[0, 0x00], [1, 0x06], [122, 0x7f], [-1, 0xfa], [-123, 0x80]];
  for (const [value, byte] of cases) assert.equal(read('i', byte), value);
});

test('a larger integer is a width and its bytes, low byte first', () => {
  // As Ruby writes them: the width is negative for a negative integer,
  // whose bytes are its two's complement.
  const cases = [
    [123, [0x01, 0x7b]],
    [255, [0x01, 0xff]],
    [256, [0x02, 0x00, 0x01]],
    [65536, [0x03, 0x00, 0x00, 0x01]],
    [2 ** 30 - 1, [0x04, 0xff, 0xff, 0xff, 0x3f]],
    [-124, [0xff, 0x84]],
    [-256, [0xff, 0x00]],
    [-257, [0xfe, 0xff, 0xfe]],
    [-65537, [0xfd, 0xff, 0xff, 0xfe]],
    [-16777217, [0xfc, 0xff, 0xff, 0xff, 0xfe]],
    [-(2 ** 30), [0xfc, 0x00, 0x00, 0x00, 0xc0]],
  ];
  for (const [value, bytes] of cases) assert.equal(read('i', bytes), value);
});

test('a symbol is written once, and linked to after that', () => {
  const list = read(
    '[', count(4), symbol('Land'), ';', count(0), symbol('Cave'), ';',
    count(1));
  assert.deepEqual(list.map((entry) => entry.name), [
    'Land', 'Land', 'Cave', 'Cave',
  ]);
  assert.ok(list[0] instanceof RubySymbol);
  assert.equal(list[1], list[0]);
});

test('a string keeps its bytes, with or without an encoding', () => {
  assert.deepEqual(read(string('Potion')), { rubyString: 'Potion' });
  // "é" in UTF-8, each byte kept as a character.
  const encoded = ['I', '"', count(2), 0xc3, 0xa9, count(1), symbol('E'), 'T'];
  assert.deepEqual(read(encoded), { rubyString: 'Ã©' });
  // The encoding's symbol is one of the payload's: later strings link to
  // it, and the next new symbol is the second.
  const list = read(
    '[', count(4), encoded,
    'I', string('b'), count(1), ';', count(0), 'T',
    symbol('Land'), ';', count(1));
  assert.deepEqual(list.slice(0, 2), [
    { rubyString: 'Ã©' }, { rubyString: 'b' },
  ]);
  assert.equal(list[3], list[2]);
  assert.equal(list[3].name, 'Land');
});

test('an array and a hash nest, the hash a Map in the order written', () => {
  const hash = read(
    '{', count(3),
    symbol('RATTATA'), '[', count(2), integer(30), '0',
    integer(7), string('seven'),
    string('key'), '{', count(0));
  assert.ok(hash instanceof Map);
  const [[species, slots], [number, text], [key, empty]] = [...hash];
  assert.equal(species.name, 'RATTATA');
  assert.deepEqual(slots, [30, null]);
  assert.equal(number, 7);
  assert.deepEqual(text, { rubyString: 'seven' });
  assert.deepEqual(key, { rubyString: 'key' });
  assert.deepEqual(empty, new Map());
});

test('an object is its class and its instance variables, by name', () => {
  const object = read(
    'o', symbol('ItemData'), count(2),
    symbol('@name'), string('Potion'),
    symbol('@price'), 'i', 0x02, 0x2c, 0x01);
  assert.ok(object instanceof RubyObject);
  assert.equal(object.className, 'ItemData');
  assert.deepEqual([...object.ivars], [
    ['@name', { rubyString: 'Potion' }], ['@price', 300],
  ]);
});

test('an object link is the very value written before', () => {
  // A string, an array, an object, a float, a hash and a class's own
  // dump each take a place in the link table, the outermost first;
  // integers, symbols, nil and booleans do not.
  const list = read(
    '[', count(16),
    integer(5), symbol('a'), '0',
    string('s'), '[', count(0), 'o', symbol('Foo'), count(0),
    'f', count(3), '1.5', '{', count(0), 'u', symbol('Table'), count(1), 0,
    '@', count(1), '@', count(2), '@', count(3), '@', count(4),
    '@', count(5), '@', count(6),
    '@', count(0));
  for (let place = 1; place <= 6; place++) {
    assert.equal(list[8 + place], list[2 + place]);
  }
  assert.deepEqual(list[6], { rubyFloat: 1.5 });
  // A container may hold itself.
  assert.equal(list[15], list);
});

test('an object written by marshal_dump takes its place before its dump', () => {
  // The list is place 0, the Rational place 1, its dump place 2 and the
  // string place 3. Were the Rational to take no place, every link after
  // it would name the value one place on.
  const list = read(
    '[', count(4),
    'U', symbol('Rational'), '[', count(2), integer(1), integer(2),
    string('a'), '@', count(3), '@', count(1));
  assert.deepEqual(list[0], [1, 2]);
  assert.equal(list[2], list[1]);
  assert.equal(list[3], list[0]);
});

test('a float is its digits, or one of the three words Ruby writes', () => {
  const float = (text) => read('f', count(text.length), text).rubyFloat;
  assert.equal(float('1.5'), 1.5);
  assert.equal(float('-0.25'), -0.25);
  assert.equal(float('inf'), Infinity);
  assert.equal(float('-inf'), -Infinity);
  assert.ok(Number.isNaN(float('nan')));
});

test('a wrapped value is read through its wrapper', () => {
  // A subclass of Hash, an object extended by a module, and one written
  // by its own marshal_dump are what they wrap.
  const hash = read('C', symbol('MonDataHash'), '{', count(1), integer(1), 'T');
  assert.deepEqual(hash, new Map([[1, true]]));
  assert.deepEqual(read('e', symbol('Mod'), string('x')), { rubyString: 'x' });
  assert.deepEqual(read('U', symbol('Ratio'), '[', count(1), integer(2)), [2]);
  // One written by _dump (a Table, a Color) keeps its bytes unread.
  const table = read('u', symbol('Table'), count(3), 0x01, 0x00, 0xff);
  assert.equal(table.rubyUserdef, 'Table');
  assert.deepEqual([...table.raw], [1, 0, 255]);
});

test('a type the reader does not know fails, naming where', () => {
  assert.throws(
    () => read('[', count(1), 'S'),
    /Unhandled Marshal type 'S' \(0x53\) at byte 4/);
});
