// Renewable item sources derived from game-file extracts
// (scripts/essentials/renewable-sources.mjs), on Reborn's: the earliest
// wild holder of each item, Pickup, the point counters and planted berries.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  pickupSources,
  plantedBerries,
  pointCounterStock,
  wildHeldSources,
} from '../scripts/essentials/renewable-sources.mjs';

const wildItems = {
  holdChances: { default: { common: 50, uncommon: 5, rare: 1 } },
  itemNames: {
    BLACKSLUDGE: 'Black Sludge',
    LEFTOVERS: 'Leftovers',
    ORANBERRY: 'Oran Berry',
    SITRUSBERRY: 'Sitrus Berry',
  },
  species: {
    GRIMER: {
      'Normal Form': {
        name: 'Grimer', common: null, uncommon: 'BLACKSLUDGE', rare: null,
      },
    },
    MUK: {
      'Normal Form': {
        name: 'Muk', common: 'BLACKSLUDGE', uncommon: null, rare: null,
      },
    },
    // One item in all three slots is always held.
    SNORLAX: {
      'Normal Form': {
        name: 'Snorlax', common: 'LEFTOVERS', uncommon: 'LEFTOVERS',
        rare: 'LEFTOVERS',
      },
    },
    // The same item in two slots adds their chances.
    MUNCHLAX: {
      'Normal Form': {
        name: 'Munchlax', common: 'ORANBERRY', uncommon: 'ORANBERRY',
        rare: 'SITRUSBERRY',
      },
    },
    RATTATA: {
      'Normal Form': {
        name: 'Rattata', common: null, uncommon: null, rare: null,
      },
    },
  },
};
const slot = (species) => ({ species, min: 2, max: 5, rate: 10 });
const encounters = {
  maps: [
    {
      mapId: 1,
      mapName: 'Peridot Ward',
      types: {
        LandDay: [slot('RATTATA'), slot('MUNCHLAX')],
        OldRod: [slot('GRIMER'), slot('GRIMER')],
        Water: [slot('MUK')],
      },
    },
    { mapId: 2, mapName: 'Route 9', types: { Cave: [slot('SNORLAX')] } },
    { mapId: 3, mapName: 'Nowhere', types: { Land: [slot('SNORLAX')] } },
  ],
};
// The ward from the start, its surfing from badge 10, the route from badge
// 12; the third map is not dated.
const badgeOf = (map, type) => {
  if (map.mapId === 3) return null;
  if (map.mapId === 2) return 12;
  return type === 'Water' ? 10 : 0;
};

test('an item restocks from the badge its first wild holder is catchable', () => {
  const sources = wildHeldSources(wildItems, encounters, badgeOf);
  assert.deepEqual(Object.fromEntries(sources), {
    // The 5% Grimer at the start beats the 50% Muk at badge 10.
    blacksludge: { badge: 0, via: 'Grimer (5%), Peridot Ward, Old Rod' },
    oranberry: { badge: 0, via: 'Munchlax (55%), Peridot Ward' },
    sitrusberry: { badge: 0, via: 'Munchlax (1%), Peridot Ward' },
    // The undated map's Snorlax does not count.
    leftovers: { badge: 12, via: 'Snorlax (100%), Route 9' },
  });
  // Among holders at one badge the likeliest hold is named.
  const allAtStart = wildHeldSources(wildItems, encounters, (map) =>
    (map.mapId === 3 ? null : 0));
  assert.equal(
    allAtStart.get('blacksludge').via, 'Muk (50%), Peridot Ward, surfing');
});

test('a slot that names a form is held for by that form', () => {
  const forms = {
    holdChances: { default: { common: 50, uncommon: 5, rare: 1 } },
    itemNames: { PECHABERRY: 'Pecha Berry', STARPIECE: 'Star Piece' },
    species: {
      RATTATA: {
        'Normal Form': {
          name: 'Rattata', common: null, uncommon: null, rare: null,
        },
        'Alolan Form': {
          name: 'Rattata', common: null, uncommon: 'PECHABERRY', rare: null,
        },
      },
      // No form is called Normal: the first listed is the one met.
      MINIOR: {
        'Red Core': {
          name: 'Minior', common: null, uncommon: 'STARPIECE', rare: null,
        },
        'Blue Core': {
          name: 'Minior', common: 'STARPIECE', uncommon: null, rare: null,
        },
      },
      DEERLING: {
        'Spring Form': {
          name: 'Deerling', common: 'PECHABERRY', uncommon: null, rare: null,
        },
      },
    },
  };
  const tables = (types) =>
    ({ maps: [{ mapId: 1, mapName: 'Route 1', types }] });
  const held = (types) =>
    Object.fromEntries(wildHeldSources(forms, tables(types), () => 0));

  // No form named: the first form, which for Rattata holds nothing.
  assert.deepEqual(held({ Land: [slot('RATTATA'), slot('MINIOR')] }), {
    starpiece: { badge: 0, via: 'Minior (5%), Route 1' },
  });
  // A number is that form, in the order the forms are listed.
  assert.deepEqual(held({ Land: [{ ...slot('RATTATA'), form: 1 }] }), {
    pechaberry: { badge: 0, via: 'Alolan Rattata (5%), Route 1' },
  });
  // A list is any of its forms; the likeliest hold is named.
  assert.deepEqual(held({ Lava: [{ ...slot('MINIOR'), form: [0, 1] }] }), {
    starpiece: {
      badge: 0, via: 'Blue Core Minior (50%), Route 1, crossing lava',
    },
  });
  // A form the game picks by a rule of its own claims no holder.
  assert.deepEqual(
    held({ Land: [{ ...slot('DEERLING'), form: 'Season' }] }), {});
});

test('a Pickup item turns up once the level cap admits its bracket', () => {
  const pickup = {
    itemNames: { ORANBERRY: 'Oran Berry', LEFTOVERS: 'Leftovers' },
    table: [
      { minLevel: 1, slots: [{ item: 'ORANBERRY' }, { item: 'NUGGET' }] },
      { minLevel: 71, slots: [{ item: 'NUGGET' }, { item: 'LEFTOVERS' }] },
      { minLevel: 81, slots: [{ item: 'LEFTOVERS' }] },
      // Past every cap: never reached.
      { minLevel: 201, slots: [{ item: 'SACREDASH' }] },
    ],
  };
  const checkpoints = [
    { badges: 0, levelCap: 20 },
    { badges: 10, levelCap: 70 },
    { badges: 11, levelCap: 75 },
    { badges: 14, levelCap: 85 },
  ];
  assert.deepEqual(Object.fromEntries(pickupSources(pickup, checkpoints, 0)), {
    oranberry: { badge: 0, via: 'a Pickup holder at level 1 or above' },
    nugget: { badge: 0, via: 'a Pickup holder at level 1 or above' },
    leftovers: { badge: 11, via: 'a Pickup holder at level 71 or above' },
  });
  // No holder before badge 2 holds the early brackets back.
  assert.equal(pickupSources(pickup, checkpoints, 2).get('oranberry').badge, 2);
});

test('a point counter stocks what it trades for points without limit', () => {
  const points = { variable: 593, name: 'Battle Floor Point' };
  const give = (item, extra = {}) => ({
    kind: 'exchange', repeat: 'unlimited', item, costs: [points], ...extra,
  });
  const itemEvents = {
    itemNames: { CHOICEBAND: 'Choice Band', SHELLBELL: 'Shell Bell' },
    events: [
      {
        mapId: 827,
        mapName: 'Nightclub Interior',
        gives: [
          give('CHOICEBAND'),
          give('CHOICEBAND'),
          // A one-time trade, a trade paid in items and a plain gift are
          // not the counter's stock.
          give('FOCUSSASH', { repeat: 'once' }),
          give('SHELLBELL', { costs: [{ item: 'SHOALSHELL', quantity: 1 }] }),
          { kind: 'gift', repeat: 'once', item: 'BEASTBALL' },
        ],
      },
      { mapId: 355, mapName: 'Agate Circus', gives: [give('ASSAULTVEST')] },
    ],
  };
  assert.deepEqual(Object.fromEntries(pointCounterStock(itemEvents, 827)), {
    choiceband: 'Nightclub Interior, Battle Floor Points',
  });
});

test('a berry regrows once a plot is open and one has been had', () => {
  const itemEvents = {
    itemNames: {
      ORANBERRY: 'Oran Berry', LANSATBERRY: 'Lansat Berry',
      ENIGMABERRY: 'Enigma Berry',
    },
    scriptRules: {
      berryPlants: {
        values: [
          { berry: 'ORANBERRY' }, { berry: 'LANSATBERRY' },
          { berry: 'ENIGMABERRY' },
        ],
      },
    },
  };
  const first = { oranberry: 0, lansatberry: 14 };
  assert.deepEqual(
    Object.fromEntries(
      plantedBerries(itemEvents, (id) => first[id] ?? null, 7)),
    // The plots open at badge 7; a berry first had later waits for it, and
    // one never had cannot be planted.
    { oranberry: 7, lansatberry: 14 },
  );
});

test('a wild holder is a Pokémon in a dated encounter table', () => {
  const read = (name) => JSON.parse(readFileSync(
    new URL(`../scripts/reborn/${name}`, import.meta.url), 'utf8'));
  const extracted = read('reborn-encounters.generated.json').data;
  const dated = read('reborn-encounter-badges.json').maps;
  const inTables = new Set(extracted.maps.flatMap((map) =>
    Object.values(map.types).flatMap((slots) =>
      slots.map((slot) => slot.species))));
  // Each carries an item in the wild data and was once entered by hand as
  // its holder, but none is in a wild table: the one Kricketot is an event
  // in Lower Peridot Ward.
  for (const species of ['KRICKETOT', 'SEEDOT', 'LOTAD']) {
    assert.ok(!inTables.has(species), species);
  }
  assert.ok(inTables.has('GRIMER'));
  // Every table has a record, one badge or null per encounter type.
  for (const map of extracted.maps) {
    const record = dated[map.mapId];
    assert.ok(record, `map ${map.mapId} ${map.mapName} is not dated`);
    assert.deepEqual(
      Object.keys(record.types).sort(), Object.keys(map.types).sort(),
      `map ${map.mapId}`,
    );
    for (const badge of Object.values(record.types)) {
      const inRange = Number.isInteger(badge) && badge >= 0 && badge <= 18;
      assert.ok(badge === null || inRange, `map ${map.mapId}: ${badge}`);
    }
  }
});
