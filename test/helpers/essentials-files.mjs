// Game files for the tests of the extractor's readers
// (scripts/essentials), which read an install: Ruby sources and install
// folders written to a temporary folder and read back through the public
// classes, and parsed Marshal values built by hand. No game is needed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  RubyObject,
  RubySource,
  RubySymbol,
} from '../../scripts/essentials/game-files.mjs';

// Writes an install of the files given (path from the install -> text or
// bytes) and returns its folder; the caller removes it.
export function writeInstall(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'essentials-install-'));
  for (const [file, contents] of Object.entries(files)) {
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  }
  return dir;
}

export const removeInstall = (dir) =>
  fs.rmSync(dir, { recursive: true, force: true });

// A Ruby source of the lines given, the first being line 1. A source is
// read whole when it is made, so its file is gone again on return.
export function rubySource(lines, file = 'Scripts/Rules.rb') {
  const dir = writeInstall({ [file]: lines.join('\n') });
  try {
    return new RubySource(dir, file);
  } finally {
    removeInstall(dir);
  }
}

// Parsed values as the Marshal reader hands them over.
export const symbol = (name) => new RubySymbol(name);

// The reader decodes a string's bytes as latin1, whatever they encode.
export const rubyString = (text) =>
  ({ rubyString: Buffer.from(text, 'utf8').toString('latin1') });

export function rubyObject(className, ivars) {
  const object = new RubyObject(className);
  for (const [name, value] of Object.entries(ivars)) {
    object.ivars.set(`@${name}`, value);
  }
  return object;
}
