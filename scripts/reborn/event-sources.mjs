/**
 * @fileoverview Derives item sources from Reborn's map events (the
 * item-events extract of extract-reborn-item-sources.mjs): the copies of an
 * item placed on the maps, each dated by its map and what gates its event,
 * and the shop stock the guide's shop table lacks. Pure: the timeline
 * builder feeds it the extracts, the tests feed it fixtures.
 */

const toId = (text) =>
  String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * The kinds of give that place a copy on a map, and what each is called.
 * A gift is left out: an NPC often hands over a copy the player could have
 * had another way (a missed item returned, a story branch), so only a
 * placed copy is certain to be one more.
 * @const {!Object<string, string>}
 */
const PLACED_KIND_WORDS = {
  itemBall: 'item ball',
  hiddenItem: 'hidden item',
};

// The `repeat` labels of a placed copy. One the map re-arms (resetByEvent)
// counts once: nothing shows it can be reached again while the reset is
// live.
const ONCE = new Set(['once', 'resetByEvent']);

/**
 * The switches that mean a badge is held, by switch name, and the badge.
 * "Third Gym" and "Sixth Gym" may turn on as the gym is entered, so they
 * bound the badge before.
 * @const {!Object<string, number>}
 */
const BADGE_SWITCHES = {
  'First Badge': 1,
  'Second Badge': 2,
  'Third Gym': 2,
  'Third Gym Done': 3,
  'Fourth Gym Done': 4,
  'Fifth Badge': 5,
  'Sixth Gym': 5,
  'Seventh Badge': 7,
  'Eighth Badge': 8,
  'Ninth Badge': 9,
  'Tenth Badge': 10,
  '11th Badge': 11,
  '12th badge': 12,
  '13th Badge': 13,
  '14th Badge': 14,
  '15th badge': 15,
  '16th Badge': 16,
  '17th Badge': 17,
  '18th Badge': 18,
  '19th Badge': 18,
  '20th Badge': 18,
};

/**
 * Badges held as each episode's story variable starts counting. The
 * nineteen episodes are the eighteen badge fights plus Corey's (3) and
 * Kiki's (6), with Titania and Amaria sharing episode 17; the badge-award
 * events' own episode variables agree (badge 5 in E7, 7 in E9, 10 in E12,
 * 13 in E15, 14 in E16, 16 in E17, 18 in E19).
 * @const {!Array<number>} Indexed by episode number.
 */
const EPISODE_START_BADGES = [
  0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17,
];

// The branch type that tests which way a character faces: no gate.
const FACING_CONDITION = 6;

// The badge one condition implies: 0 for one that gates nothing in time (a
// confirmation, a price, a negation, a facing test, a counter at zero),
// null for one this cannot date.
function badgeOfCondition(condition, switchBadge) {
  if (
    condition.choice != null || condition.money != null ||
    condition.not != null || condition.selfSwitch != null ||
    condition.is === false || condition.conditionType === FACING_CONDITION
  ) {
    return 0;
  }
  if (condition.switch != null) return switchBadge(condition.name);
  if (condition.variable != null) {
    const floor = condition.atLeast ?? condition.value;
    const lowerBound = condition.atLeast != null ||
      ['>=', '>', '=='].includes(condition.op);
    if (!lowerBound || typeof floor !== 'number') return null;
    if (floor <= 0 && condition.atLeast != null) return 0;
    const episode = /^E(\d+) Story/.exec(condition.name || '');
    return episode ? EPISODE_START_BADGES[Number(episode[1])] ?? null : null;
  }
  return null;
}

/**
 * @param {!Array<!Object>} conditions Page conditions and enclosing
 *     branches of a give, as the extract records them.
 * @param {function(string): ?number} switchBadge Switch name -> the badge
 *     count it implies; null for a switch that dates nothing.
 * @return {?number} The least badge count at which every condition can
 *     hold: the latest badge switch or episode among them. Null when a
 *     condition gates the give by something that is no badge or episode (a
 *     quest switch, an item check), since nothing then dates it.
 */
export function conditionBadge(conditions, switchBadge) {
  let badge = 0;
  for (const condition of conditions) {
    const implied = badgeOfCondition(condition, switchBadge);
    if (implied == null) return null;
    badge = Math.max(badge, implied);
  }
  return badge;
}

/**
 * @param {string} name A switch name.
 * @return {?number} The badge a badge switch implies.
 */
export function badgeSwitchBadge(name) {
  return BADGE_SWITCHES[name] ?? null;
}

/**
 * The copies of each item placed on the maps: item balls and hidden items.
 * @param {{itemNames: !Object<string, string>, events: !Array<!Object>}}
 *     itemEvents The item-events extract.
 * @return {!Map<string, !Array<{mapId: number, mapName: string,
 *     kind: string, conditions: !Array<!Object>}>>} Item id -> its placed
 *     copies. An item counts once per map name, as the first listed: a map
 *     often exists in several versions (a room's water levels, a puzzle's
 *     states, a ward before and after its restoration) that repeat one
 *     copy, and a version cannot be told from a second copy.
 */
export function placedCopies(itemEvents) {
  const copies = new Map();
  const spots = new Set();
  for (const event of itemEvents.events) {
    const byItem = new Map();
    for (const give of event.gives) {
      const kind = PLACED_KIND_WORDS[give.kind];
      if (!kind || !give.item || !ONCE.has(give.repeat)) continue;
      const page = event.pages.find((entry) => entry.page === give.page);
      const conditions = [
        ...(page?.conditions || []),
        ...(give.within || []),
      ].filter((condition) => condition.selfSwitch == null);
      const id = toId(itemEvents.itemNames[give.item] || give.item);
      const current = byItem.get(id);
      if (!current || conditions.length < current.conditions.length) {
        byItem.set(id, {
          mapId: event.mapId, mapName: event.mapName, kind, conditions,
        });
      }
    }
    for (const [id, copy] of byItem) {
      const spot = `${id}|${event.mapName}`;
      if (spots.has(spot)) continue;
      spots.add(spot);
      copies.set(id, [...(copies.get(id) || []), copy]);
    }
  }
  return copies;
}

/**
 * Shop stock the guide's shop table lacks. A mart call sells its items
 * together, so an item the table misses opens with the latest of the items
 * sold beside it.
 * @param {{itemNames: !Object<string, string>, events: !Array<!Object>}}
 *     itemEvents The item-events extract.
 * @param {function(string): ?number} shopBadgeOf Item id -> the badge the
 *     guide's shop table sells it from; null when the table lacks it.
 * @param {function(number): ?number} reachBadgeOf Map id -> the badge
 *     count the mart's map is reachable at.
 * @return {!Map<string, {badge: number, via: string}>} Item id -> the
 *     earliest mart that sells it and can be dated, for items the table
 *     lacks.
 */
export function missedShopStock(itemEvents, shopBadgeOf, reachBadgeOf) {
  const missed = new Map();
  for (const event of itemEvents.events) {
    for (const give of event.gives) {
      if (give.kind !== 'mart') continue;
      const ids = (give.stock || []).map((symbol) =>
        toId(itemEvents.itemNames[symbol] || symbol));
      const known = ids.map(shopBadgeOf).filter((badge) => badge != null);
      if (!known.length) continue;
      const badge = Math.max(...known, reachBadgeOf(event.mapId) ?? 0);
      for (const id of ids) {
        if (shopBadgeOf(id) != null) continue;
        if (missed.has(id) && missed.get(id).badge <= badge) continue;
        missed.set(id, { badge, via: event.mapName });
      }
    }
  }
  return missed;
}

/**
 * The badge count at which each map is first reachable, for dating what
 * sits on it.
 * @param {!Object<string, {name: string, parentId: number,
 *     mapSwitches: (!Array<{name: string, is: boolean}>|undefined)}>} maps
 *     The map tree, and the switches a map exists under.
 * @param {!Object<string, {types: !Object<string, ?number>}>}
 *     encounterBadges The dated encounter tables
 *     (reborn-encounter-badges.json).
 * @param {!Object<string, number>} mapSwitchBadges Map switch name -> the
 *     badge count from which it can be on.
 * @return {function(number): ?number} Map id -> its badge count: the
 *     earliest of its own encounter tables, else the nearest ancestor's in
 *     the map tree (a building inside a ward, a floor of a cave); never
 *     before a switch the map exists under. Null for a map with no dated
 *     table at or above it, such as a town.
 */
export function mapReachBadges(maps, encounterBadges, mapSwitchBadges) {
  const tableBadge = (id) => {
    const badges = Object.values(encounterBadges[id]?.types || {})
      .filter((badge) => badge != null);
    return badges.length ? Math.min(...badges) : null;
  };
  return (mapId) => {
    let badge = null;
    for (let id = mapId; maps[id] && badge == null; id = maps[id].parentId) {
      badge = tableBadge(id);
    }
    if (badge == null) return null;
    for (const { name, is } of maps[mapId].mapSwitches || []) {
      if (is && mapSwitchBadges[name] != null) {
        badge = Math.max(badge, mapSwitchBadges[name]);
      }
    }
    return badge;
  };
}
