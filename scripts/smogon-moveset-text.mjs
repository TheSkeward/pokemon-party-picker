/**
 * @fileoverview Reads Smogon's monthly moveset text: a file is one boxed
 * block per Pokémon (its name, its raw count, then boxed sections of
 * "name  12.345%" lines), and every generation's file is laid out alike.
 */
import { toId } from '../src/utils/ids.js';

// The sections a block can hold, in the file's order; each ends where the
// next begins.
const SECTION_BOUNDARY =
  '(?:Abilities|Items|Spreads|Moves|Teammates|Checks and Counters)';

const BLOCK =
  /\+-+\+\s*\|\s*([^|\n]+?)\s*\|\s*\+-+\+\s*\|\s*Raw count:\s*([\d,]+)\s*([\s\S]*?)(?=\+-+\+\s*\|\s*[^|\n]+?\s*\|\s*\+-+\+\s*\|\s*Raw count:|$)/g;
const ENTRY = /\|\s*([^|]+?)\s+([\d.]+)%\s*(?=\||$)/g;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} text A moveset file.
 * @return {!Array<{pokemonId: string, name: string, rawCount: number,
 *     body: string}>} One entry per Pokémon, in the file's order; `body`
 *     is the rest of its block, to be read with sectionEntries.
 */
export function movesetBlocks(text) {
  return [...text.replace(/\r/g, '').matchAll(BLOCK)].map((match) => {
    const name = match[1].trim();
    return {
      pokemonId: toId(name),
      name,
      rawCount: Number.parseInt(match[2].replaceAll(',', ''), 10),
      body: match[3],
    };
  });
}

/**
 * @param {string} body A Pokémon's block, as movesetBlocks returns it.
 * @param {string} sectionName "Abilities", "Items", "Spreads" or "Moves".
 * @return {!Array<{name: string, usage: number}>} The section's lines, in
 *     order, with the "Other" and "Nothing" lines the file itself adds;
 *     empty when the block has no such section.
 */
export function sectionEntries(body, sectionName) {
  const section = body.match(new RegExp(
    `\\+[-+]+\\+\\s*\\|\\s*${escapeRegex(sectionName)}\\s*\\|\\s*([\\s\\S]*?)(?=\\+[-+]+\\+\\s*\\|\\s*${SECTION_BOUNDARY}\\s*\\||$)`,
    'i',
  ));
  if (!section) return [];
  const entries = [];
  for (const [, rawName, percent] of section[1].matchAll(ENTRY)) {
    const name = rawName.trim();
    const usage = Number.parseFloat(percent);
    if (name && Number.isFinite(usage)) entries.push({ name, usage });
  }
  return entries;
}
