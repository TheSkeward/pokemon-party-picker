// A memo that records which keys of a record its computation read
// (utils/track-reads.js) outlives a change to any other key.
import assert from 'node:assert/strict';
import test from 'node:test';

import { trackReads } from '../src/utils/track-reads.js';

test('a tracked record agrees with another on the keys that were read', () => {
  const owned = { leftovers: 1, firestone: 2, aspearberry: 6 };
  const reads = trackReads(owned);
  // Nothing read yet: anything agrees.
  assert.ok(reads.agreesWith({}));

  assert.equal(reads.record.firestone, 2);
  assert.equal(reads.record.choiceband, undefined);
  assert.ok('leftovers' in reads.record);

  // The keys it never looked at may change or go.
  assert.ok(reads.agreesWith({ leftovers: 1, firestone: 2 }));
  assert.ok(reads.agreesWith({ leftovers: 1, firestone: 2, sachet: 6 }));
  // A key it read, or found absent, may not.
  assert.ok(!reads.agreesWith({ leftovers: 1, firestone: 1 }));
  assert.ok(!reads.agreesWith({ firestone: 2 }));
  assert.ok(!reads.agreesWith({ leftovers: 1, firestone: 2, choiceband: 1 }));
});

test('listing the keys reads them all', () => {
  const owned = { leftovers: 1 };
  const reads = trackReads(owned);
  assert.deepEqual({ ...reads.record }, { leftovers: 1 });
  assert.ok(!reads.agreesWith({ leftovers: 1 }));
});
