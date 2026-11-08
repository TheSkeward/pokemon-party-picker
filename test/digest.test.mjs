import test from 'node:test';
import assert from 'node:assert/strict';
import { digest } from '../src/utils/digest.js';

test('digest is fixed-length, stable and sensitive to any change', () => {
  const text = `{accelgor:{moveIds:["doubleedge","endure"]}}`.repeat(5000);
  const first = digest(text);
  assert.match(first, /^[0-9a-z]{28}$/);
  assert.equal(digest(text), first);
  assert.notEqual(digest(`${text}y`), first);
  assert.notEqual(digest(text.replace('endure', 'endurf')), first);
  assert.notEqual(digest(''), digest(' '));
});
