// The held-item inventory (progression panel): the setters behind its bulk
// actions, and the expected counts the sync sets the list to — what the
// game has handed out by the player's badge.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearOwnedItems,
  DEFAULT_PROGRESSION,
  MAX_TRACKED_ITEM_COUNT,
  setOwnedItemCounts,
} from '../src/playthrough/progression.js';
import { renderProgressionPanel } from '../src/playthrough/progression-view.js';
import {
  expectedItemCount,
  getExpectedItemChanges,
} from '../src/games/items.js';
import { REBORN_ITEM_SOURCES } from '../src/generated/rebornItemTimeline.generated.js';

// Item id -> the badge its first shop source opens at.
const REBORN_SHOP_ITEM_BADGES = Object.fromEntries(
  Object.entries(REBORN_ITEM_SOURCES).flatMap(([id, sources]) => {
    const badges = sources
      .filter((source) => source.kind === 'shop')
      .map((source) => source.badge);
    return badges.length ? [[id, Math.min(...badges)]] : [];
  }),
);

function renderPanel(progression) {
  globalThis.localStorage = { getItem: () => null };
  try {
    return renderProgressionPanel({ ...DEFAULT_PROGRESSION, ...progression });
  } finally {
    delete globalThis.localStorage;
  }
}

test('setOwnedItemCounts sets, clamps and removes; clearOwnedItems empties', () => {
  const base = { ownedItems: { leftovers: 2, choiceband: 6, pixieplate: 6 } };
  const next = setOwnedItemCounts(base, {
    leftovers: 6,
    pixieplate: 1, // lowers: a sync sets the count, it does not only raise
    eviolite: 99, // clamps to the tracking cap
    choiceband: 0, // removes
    '': 6, // ignored
  });

  assert.deepEqual(next.ownedItems, {
    leftovers: MAX_TRACKED_ITEM_COUNT,
    pixieplate: 1,
    eviolite: MAX_TRACKED_ITEM_COUNT,
  });
  // Original untouched (progression updates are immutable).
  assert.equal(base.ownedItems.leftovers, 2);
  assert.deepEqual(clearOwnedItems(next).ownedItems, {});
});

test('getExpectedItemChanges: badge-gated, set against the list, stable order', () => {
  assert.ok(
    Object.keys(REBORN_SHOP_ITEM_BADGES).length >= 150,
    "the generated sources should cover the guide's full shop stock",
  );

  const atFour = getExpectedItemChanges(4, {});
  assert.ok(atFour.length > 0, 'items are out there by badge 4');
  for (const item of atFour) {
    assert.equal(item.count, expectedItemCount(item.id, 4), item.id);
    assert.ok(item.count >= 1 && item.count <= MAX_TRACKED_ITEM_COUNT, item.id);
    assert.equal(item.owned, 0);
  }
  const names = atFour.map((item) => item.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));

  // A synced list matches; a later badge has more to offer.
  const owned = Object.fromEntries(atFour.map((item) => [item.id, item.count]));
  assert.equal(getExpectedItemChanges(4, owned).length, 0);
  assert.ok(getExpectedItemChanges(18, owned).length > 0);

  // No badge selected -> nothing offered (never guess the gamestate).
  assert.equal(getExpectedItemChanges(null, {}).length, 0);
});

test('a mined item counts what the rocks reached so far yield on average', () => {
  // A Fire Stone: one from an NPC at badge 2, then the rocks: the Mining
  // Kit comes at badge 3, and six copies are a full supply.
  assert.deepEqual(
    [2, 3, 4, 7].map((badges) => expectedItemCount('firestone', badges)),
    [1, 2, 5, MAX_TRACKED_ITEM_COUNT],
  );
  // A Plate is rare in a dig: one by badge 4 and two by 8, an NPC's Pixie
  // Plate making three at 13, until the post-game rocks that come back.
  assert.deepEqual(
    [3, 4, 8, 12, 13, 18]
      .map((badges) => expectedItemCount('pixieplate', badges)),
    [0, 1, 2, 2, 3, MAX_TRACKED_ITEM_COUNT],
  );
  // A shop outruns the rocks.
  assert.equal(expectedItemCount('lightclay', 2), MAX_TRACKED_ITEM_COUNT);
});

test('the sync lowers a count above the expected one and leaves the unexpected alone', () => {
  const changes = getExpectedItemChanges(6, {
    pixieplate: MAX_TRACKED_ITEM_COUNT, // one expected by badge 6
    firegem: 1, // the Gem vendor restocks from badge 6
    leftovers: 1, // none expected before badge 11: the player's own find
    eviolite: 2, // none expected before badge 9
  });
  const byId = Object.fromEntries(changes.map((item) => [item.id, item]));
  assert.deepEqual(byId.pixieplate, {
    id: 'pixieplate', name: 'Pixie Plate', count: 1,
    owned: MAX_TRACKED_ITEM_COUNT,
  });
  assert.deepEqual(byId.firegem, {
    id: 'firegem', name: 'Fire Gem', count: MAX_TRACKED_ITEM_COUNT, owned: 1,
  });
  assert.ok(!('leftovers' in byId));
  assert.ok(!('eviolite' in byId));
});

test('the inventory panel offers the sync and the removal', () => {
  const html = renderPanel({
    checkpoint: 'badge-6',
    levelCap: '55',
    ownedItems: { pixieplate: MAX_TRACKED_ITEM_COUNT, firegem: 1 },
  });
  const expectedPanel =
    html.match(/<details class="item-expected"[\s\S]*?<\/details>/)?.[0] || '';
  assert.match(html, /data-expected-sync-button\s*>\s*Set \d+ items to expected/);
  assert.match(html, /data-owned-items-clear-button\s*>\s*Remove all/);
  assert.match(expectedPanel, /Differs from the expected count at your badge/);
  assert.match(expectedPanel, /Pixie Plate 6\+ → 1</);
  assert.match(expectedPanel, /Fire Gem 1 → 6\+</);
  // An item not tracked yet shows only where it is going.
  assert.match(expectedPanel, />Light Clay 6\+</);

  // Nothing tracked: nothing to remove. No badge picked: nothing to sync.
  const empty = renderPanel({ checkpoint: '', ownedItems: {} });
  assert.match(empty, /data-expected-sync-button disabled>\s*Matches the expected counts/);
  assert.match(empty, /data-owned-items-clear-button disabled>/);
  assert.doesNotMatch(empty, /<details class="item-expected"/);
});

test('badge-1 shop stock includes the user-verified Obsidia berry floor', () => {
  // Verified against in-game screenshots: after Badge 1 the Department
  // Store berry shop sells the six heal/status berries alongside Persim +
  // the EV berries. The SHOP_STOCK overlay in build-item-timeline.mjs is
  // an agreement check on these user-verified rows.
  const VERIFIED_BADGE_1_BERRIES = [
    'oranberry', 'cheriberry', 'pechaberry', 'rawstberry', 'chestoberry',
    'aspearberry', 'persimberry', 'pomegberry', 'kelpsyberry', 'qualotberry',
    'hondewberry', 'grepaberry', 'tamatoberry',
  ];
  for (const id of VERIFIED_BADGE_1_BERRIES) {
    assert.equal(
      REBORN_SHOP_ITEM_BADGES[id],
      1,
      `${id} must be shop-purchasable at badge 1`,
    );
  }
  const offered = new Map(
    getExpectedItemChanges(1, {}).map((item) => [item.id, item.count]));
  for (const id of VERIFIED_BADGE_1_BERRIES) {
    assert.equal(
      offered.get(id), MAX_TRACKED_ITEM_COUNT,
      `${id} must sync to 6+ at badge 1`,
    );
  }
});

test('shop rows masked by earlier one-off pickups survive extraction', () => {
  // An item with ANY earlier non-shop pickup (a hidden find, a story gift)
  // must still get its renewable shop timing from the guide's Shops tab.
  // Pins are spot-audited sheet rows.
  const MASKED_SHOP_ROWS = {
    leftovers: 17,
    lifeorb: 17,
    choiceband: 18,
    firegem: 6, // the badge-6 type-gem vendor stocks all gems
    darkgem: 6,
    firestone: 13, // post-restoration Department Store stone floor
    duskstone: 13,
    metalcoat: 13,
    kingsrock: 16,
  };
  for (const [id, badge] of Object.entries(MASKED_SHOP_ROWS)) {
    assert.equal(
      REBORN_SHOP_ITEM_BADGES[id],
      badge,
      `${id} must be shop-purchasable at badge ${badge}`,
    );
  }
});
