/**
 * @fileoverview Reads an install of a game of the Reborn engine family: its
 * compiled Data files (Ruby Marshal) as plain JS values, and its Ruby
 * sources as lines that a rule can be found in and cited by.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  parseMarshal,
  RubyObject,
  RubySymbol,
} from './parse-marshal.mjs';

// The classes parsed data is made of, for the readers that take it parsed.
export { RubyObject, RubySymbol };

// The Marshal reader decodes byte strings as latin1; the game files are
// UTF-8.
const decode = (value) =>
  Buffer.from(value.rubyString, 'latin1').toString('utf8');

/**
 * Converts a parsed Marshal value to plain JS: symbols and strings to
 * strings, objects to records keyed by ivar name without the `@`. Hashes
 * stay Maps so integer and symbol keys keep their order and type.
 *
 * Compiled data may point back at something that contains it (a Pokémon
 * form at the species it is a form of). Such a pointer becomes null: the
 * plain copy is a tree, and what it would lead to is already above it.
 * @param {*} value
 * @return {*}
 */
export function toPlain(value) {
  // The objects, hashes and arrays being converted, outermost first.
  const open = new Set();
  const within = (container, convertContents) => {
    if (open.has(container)) return null;
    open.add(container);
    const plain = convertContents();
    open.delete(container);
    return plain;
  };
  const convert = (entry) => {
    if (entry == null) return null;
    if (entry instanceof RubySymbol) return entry.name;
    if (entry instanceof RubyObject) {
      return within(entry, () => {
        const out = {};
        for (const [key, ivar] of entry.ivars) {
          out[key.replace(/^@/, '')] = convert(ivar);
        }
        return out;
      });
    }
    if (entry instanceof Map) {
      return within(entry, () => {
        const out = new Map();
        for (const [key, item] of entry) out.set(convert(key), convert(item));
        return out;
      });
    }
    if (Array.isArray(entry)) {
      return within(entry, () => entry.map(convert));
    }
    if (typeof entry === 'object') {
      if ('rubyString' in entry) return decode(entry);
      if ('rubyFloat' in entry) return entry.rubyFloat;
      if ('rubyUserdef' in entry) return null;
    }
    return entry;
  };
  return convert(value);
}

/**
 * @param {string} text Ruby source text.
 * @return {!Array<string>} Every symbol literal in it, without the colon.
 */
export const symbolsIn = (text) =>
  [...text.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]);

/**
 * @param {string} text
 * @return {!Array<number>} Every integer in it.
 */
export const numbersIn = (text) => (text.match(/-?\d+/g) ?? []).map(Number);

/**
 * Splits a Ruby argument list on its top-level commas.
 * @param {string} text
 * @return {!Array<string>}
 */
export function splitArgs(text) {
  const args = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if ('([{'.includes(ch)) {
      depth++;
    } else if (')]}'.includes(ch)) {
      depth--;
    } else if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

/**
 * A Ruby source file split into lines, for line-cited lookups: a rule read
 * through `find` fails loudly when a game update moves or rewrites it.
 */
export class RubySource {
  /**
   * @param {string} installDir
   * @param {string} file Path relative to the install, forward slashes.
   */
  constructor(installDir, file) {
    this.file = file;
    this.lines = fs
      .readFileSync(path.join(installDir, file), 'utf8')
      .split(/\r?\n/);
  }

  /**
   * @param {!RegExp} pattern
   * @param {number=} from 1-based line to start at.
   * @return {{line: number, match: !RegExpMatchArray}} First matching line.
   */
  find(pattern, from = 1) {
    for (let i = from - 1; i < this.lines.length; i++) {
      const match = this.lines[i].match(pattern);
      if (match) return { line: i + 1, match };
    }
    throw new Error(`${this.file}: no line matches ${pattern} from ${from}`);
  }

  /**
   * @param {number} from 1-based, inclusive.
   * @param {number} to 1-based, inclusive.
   * @return {string}
   */
  text(from, to) {
    return this.lines.slice(from - 1, to).join('\n');
  }

  /**
   * @param {number} line
   * @param {number=} endLine
   * @return {{file: string, line: number, endLine: (number|undefined)}}
   */
  cite(line, endLine) {
    return endLine
      ? { file: this.file, line, endLine }
      : { file: this.file, line };
  }
}

/**
 * One install's files.
 */
export class GameInstall {
  /** @param {string} dir The folder that holds Data and Scripts. */
  constructor(dir) {
    this.dir = dir;
    this.dataDir = path.join(dir, 'Data');
  }

  /**
   * @param {string} name A file in Data.
   * @return {*} Its parsed Marshal value, Ruby objects and symbols intact.
   */
  parse(name) {
    return parseMarshal(fs.readFileSync(path.join(this.dataDir, name)));
  }

  /**
   * @param {string} name A file in Data.
   * @return {*} Its contents as plain JS (toPlain).
   */
  load(name) {
    return toPlain(this.parse(name));
  }

  /**
   * @param {string} file Path relative to the install, forward slashes.
   * @return {!RubySource}
   */
  source(file) {
    return new RubySource(this.dir, file);
  }

  /**
   * @return {!Iterable<{mapId: number, map: !Object}>} Every Map###.rxdata
   *     as plain JS, in map id order, read one at a time.
   */
  *maps() {
    const names = fs
      .readdirSync(this.dataDir)
      .filter((name) => /^Map\d+\.rxdata$/.test(name))
      .sort();
    for (const name of names) {
      yield { mapId: Number(name.match(/\d+/)[0]), map: this.load(name) };
    }
  }
}
