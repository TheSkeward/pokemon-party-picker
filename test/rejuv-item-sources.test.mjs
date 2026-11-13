// Rejuvenation's inputs to the item-timeline builder (scripts/rejuv): its
// dated maps, its event dating, and what the builder makes of its
// extracts with no guide's listing to lean on.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  conditionBadge,
  mapReachBadges,
} from '../scripts/essentials/event-sources.mjs';
import { buildItemSources } from '../scripts/essentials/item-timeline.mjs';
import { REJUV_EVENT_DATING } from '../scripts/rejuv/event-dating.mjs';
import { rejuvItemTimeline } from '../scripts/rejuv/item-timeline.mjs';

const read = (name) => JSON.parse(readFileSync(
  new URL(`../scripts/rejuv/${name}`, import.meta.url), 'utf8'));

test('every table the game reads is dated, and every dated map reached', () => {
  const extracted = read('rejuv-map-encounters.generated.json').data;
  const dated = read('rejuv-encounter-badges.json').maps;
  const inRange = (badge) =>
    Number.isInteger(badge) && badge >= 0 && badge <= 18;
  for (const map of extracted.maps) {
    const record = dated[map.mapId];
    assert.ok(record, `map ${map.mapId} ${map.mapName} is not dated`);
    assert.deepEqual(
      Object.keys(record.types).sort(), Object.keys(map.types).sort(),
      `map ${map.mapId}`,
    );
  }
  for (const [mapId, record] of Object.entries(dated)) {
    // A reach of null says the map is never entered; its tables then
    // cannot be met either.
    assert.ok(
      record.reach === null || inRange(record.reach), `map ${mapId} reach`);
    for (const badge of Object.values(record.types)) {
      assert.ok(badge === null || inRange(badge), `map ${mapId}: ${badge}`);
      assert.ok(
        badge === null || (record.reach !== null && badge >= record.reach),
        `map ${mapId}: a table met before the map is reached`,
      );
    }
  }
});

test('a map the game never enters dates nothing on it or inside it', () => {
  const { maps } = read('rejuv-item-events.generated.json').data;
  const reach = mapReachBadges(
    maps, read('rejuv-encounter-badges.json').maps, {});
  // East Gearen City, and the Chrisola Hotel inside it.
  assert.equal(reach(51), 0);
  assert.equal(reach(230), 0);
  // The Xenpurgis floors are a separate mode, under a square that is
  // entered in the main story.
  assert.equal(reach(640), 15);
  assert.equal(reach(646), null);
  // The opening scene's map hands out password gifts only.
  assert.equal(reach(1), null);
});

test('gym switches and story variables date an event; the rest do not', () => {
  const { switchBadge, variableBadge } = REJUV_EVENT_DATING;
  assert.equal(switchBadge('Defeated Gym 5'), 5);
  // Keta is beaten before his badge is handed over.
  assert.equal(switchBadge('Defeated Gym 2'), 1);
  // The sixteenth and seventeenth badges come together.
  assert.equal(switchBadge('Defeated Gym 16'), 17);
  assert.equal(switchBadge('TerajumaPassword'), null);

  assert.equal(variableBadge('Post12thBadge', 5), 12);
  assert.equal(variableBadge('Post12thBadge', 129), 13);
  // Not dated below the first value a badge is known to be held at.
  assert.equal(variableBadge('Ael', 3), null);
  assert.equal(variableBadge('Ael', 5), 2);
  // A value of the moment gates nothing; a mode of its own dates nothing.
  assert.equal(variableBadge('Battle Results', 1), 0);
  assert.equal(variableBadge('XenpurgisBag', 1), null);

  assert.equal(
    conditionBadge(
      [
        { switch: 14, name: 's:PBDayNight.isDay?(pbGetTimeNow)' },
        { variable: 181, name: 'Post7thbadge', atLeast: 2 },
        { variable: 1, name: 'Temp Pokemon Choice', op: '==', value: 3 },
      ],
      REJUV_EVENT_DATING,
    ),
    7,
  );
});

test('the files alone source shops, holders by form and rocks that return', () => {
  const { game } = rejuvItemTimeline();
  const { sources } = buildItemSources(game);
  const find = (id, kind) =>
    sources.get(id)?.find((source) => source.kind === kind);

  // The Berry Emporium, in the city the game opens in.
  assert.deepEqual(find('oranberry', 'shop'), {
    kind: 'shop', badge: 0, via: 'East Gearen City',
  });
  // The Route 3 stand is open by day, which gates nothing in badges.
  assert.deepEqual(find('sachet', 'shop'), {
    kind: 'shop', badge: 3, via: 'Route 3',
  });
  // A slot keyed by form: the Galarian Farfetch'd holds the Leek.
  assert.deepEqual(find('leek', 'wild'), {
    kind: 'wild', badge: 5, via: "Galarian Farfetch'd (5%), Helojak Island",
  });
  // The Zorrialyn Desert rock returns after a wait, so what it buries
  // restocks; the rocks of the Blacksteeple stay do not.
  assert.deepEqual(find('heatrock', 'regrow'), {
    kind: 'regrow', badge: 12,
    via: 'mining rocks that come back, Zorrialyn Desert',
  });
  // An evolution item outside the held-item catalog is sourced too.
  assert.deepEqual(sources.get('blackaugurite')[0], {
    kind: 'single', badge: 9, count: 1, via: 'item ball, Decompression Lab',
  });
  const all = [...sources.values()].flat();
  // Nothing is mined before the Mining Kit is won at Blacksteeple.
  assert.equal(
    Math.min(...all.filter((source) => source.kind === 'mining')
      .map((source) => source.badge)),
    4,
  );
  // Nothing comes from a map the player never enters.
  for (const { via } of all) {
    assert.ok(!/Xenpurgis|Testing Map|Intro\b/.test(via), via);
  }
  // Every source is of a known held item, with a badge in range.
  for (const [id, list] of sources) {
    assert.ok(game.knownIds.has(id), id);
    for (const { badge } of list) {
      assert.ok(Number.isInteger(badge) && badge >= 0 && badge <= 18, id);
    }
  }
});
