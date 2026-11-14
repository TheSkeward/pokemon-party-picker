// Smogon's monthly moveset text, read into Pokémon blocks and their
// sections (scripts/smogon-moveset-text.mjs). The harvest's data builder
// and the Gen 5 item builder each carried a copy of this reader; every
// usage figure on the site starts here.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  movesetBlocks, sectionEntries,
} from '../scripts/smogon-moveset-text.mjs';

// Two blocks as the files lay them out, the second without spreads.
const TEXT = [
  ' +----------------------------------------+ ',
  ' | Gengar-Mega                            | ',
  ' +----------------------------------------+ ',
  ' | Raw count: 1,234,567                    | ',
  ' | Avg. weight: 0.002                      | ',
  ' +----------------------------------------+ ',
  ' | Abilities                              | ',
  ' | Shadow Tag 100.000%                     | ',
  ' +----------------------------------------+ ',
  ' | Items                                  | ',
  ' | Gengarite 99.500%                       | ',
  ' | Other  0.500%                           | ',
  ' +----------------------------------------+ ',
  ' | Spreads                                | ',
  ' | Timid:0/0/0/252/4/252 61.250%           | ',
  ' | Other 38.750%                           | ',
  ' +----------------------------------------+ ',
  ' | Moves                                  | ',
  ' | Shadow Ball 88.100%                     | ',
  ' | Will-O-Wisp 12.345%                     | ',
  ' | Nothing  0.010%                         | ',
  ' +----------------------------------------+ ',
  ' | Teammates                              | ',
  ' | Togekiss +4.321%                        | ',
  ' +----------------------------------------+ ',
  ' | Checks and Counters                    | ',
  ' | Tyranitar 61.002 (72.31±2.83)          | ',
  ' +----------------------------------------+ ',
  ' +----------------------------------------+ ',
  ' | Mr. Mime                               | ',
  ' +----------------------------------------+ ',
  ' | Raw count: 42                           | ',
  ' +----------------------------------------+ ',
  ' | Abilities                              | ',
  ' | Filter 60.000%                          | ',
  ' | Soundproof 40.000%                      | ',
  ' +----------------------------------------+ ',
  ' | Items                                  | ',
  ' | Nothing 100.000%                        | ',
  ' +----------------------------------------+ ',
  ' | Moves                                  | ',
  ' | Psychic 100.000%                        | ',
  ' +----------------------------------------+ ',
].join('\r\n');

test('a file is read into one block per Pokémon', () => {
  const blocks = movesetBlocks(TEXT);
  assert.deepEqual(
    blocks.map(({ pokemonId, name, rawCount }) => [pokemonId, name, rawCount]),
    [['gengarmega', 'Gengar-Mega', 1234567], ['mrmime', 'Mr. Mime', 42]]);
  assert.deepEqual(movesetBlocks(''), []);
});

test('a section is its lines, each a name and a share', () => {
  const [gengar, mime] = movesetBlocks(TEXT);
  assert.deepEqual(sectionEntries(gengar.body, 'Abilities'), [
    { name: 'Shadow Tag', usage: 100 },
  ]);
  // The file's own remainder lines are kept; a caller drops them or not.
  assert.deepEqual(sectionEntries(gengar.body, 'Items'), [
    { name: 'Gengarite', usage: 99.5 }, { name: 'Other', usage: 0.5 },
  ]);
  assert.deepEqual(sectionEntries(gengar.body, 'Spreads'), [
    { name: 'Timid:0/0/0/252/4/252', usage: 61.25 },
    { name: 'Other', usage: 38.75 },
  ]);
  // A section ends where the next begins: no teammate is read as a move.
  assert.deepEqual(sectionEntries(gengar.body, 'Moves'), [
    { name: 'Shadow Ball', usage: 88.1 },
    { name: 'Will-O-Wisp', usage: 12.345 },
    { name: 'Nothing', usage: 0.01 },
  ]);

  // One Pokémon's block never runs into the next.
  assert.deepEqual(sectionEntries(mime.body, 'Abilities'), [
    { name: 'Filter', usage: 60 }, { name: 'Soundproof', usage: 40 },
  ]);
  assert.deepEqual(
    sectionEntries(mime.body, 'Moves'), [{ name: 'Psychic', usage: 100 }]);
  // A section the block does not have.
  assert.deepEqual(sectionEntries(mime.body, 'Spreads'), []);
});
