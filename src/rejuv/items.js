/**
 * @fileoverview Rejuvenation's item content, in the shapes games/items.js
 * and games/schedule.js read: curated from BIGJRA's walkthrough (the shop
 * listings and pickups, timed by the chapter they first appear in, as in
 * rejuv/badge-timeline.js) and the game's own marts.dat extract
 * (scripts/rejuv/rejuv-marts.generated.json) for what the shops stock and
 * the badge each sale demands. Every entry says where it comes from;
 * anything absent is unknown, and the engine surfaces it as such.
 *
 * Badges are "the count held when the chapter begins", so a pickup late in
 * a chapter may be a badge earlier than it really is.
 */

/**
 * The evolution items Rejuvenation hands out, with where each comes from.
 * @type {!Object<string, {source: string}>}
 */
export const REJUV_EVOLUTION_ITEM_AVAILABILITY = Object.freeze({
  // Route 2's Kecleon Bazaar (chapter 2) sells these at 25,000 each; Lost
  // Camp (chapter 5) sells Water, Fire, and Leaf Stones at 2,100.
  waterstone: { source: 'Route 2 quest reward; Kecleon Bazaar (25,000); Lost Camp (2,100)' },
  firestone: { source: 'Lost Camp (2,100); Kecleon Bazaar (25,000)' },
  leafstone: { source: 'Lost Camp (2,100); hidden on Route 4' },
  duskstone: { source: 'Kecleon Bazaar (25,000); hidden in West Gearen City' },
  dawnstone: { source: 'Kecleon Bazaar (25,000)' },
  shinystone: { source: 'Kecleon Bazaar (25,000); Aquamarine Cave quest reward' },
  icestone: { source: 'Kecleon Bazaar (25,000)' },
  moonstone: { source: 'hidden on Route 3 (chapter 4)' },
  sunstone: { source: 'hidden on Route 3 (chapter 4); Aquamarine Cave' },
  thunderstone: { source: 'the chapter-15 stone vendor' },
  // Rejuvenation's trade replacement.
  linkheart: { source: 'Kecleon Bazaar (25,000)' },
  // Fixed pickups and quest rewards.
  reapercloth: { source: 'one copy: Weather Institute (chapter 6)' },
  razorclaw: { source: 'Kristiline Town (chapter 8); chapter-15 vendor (2,100)' },
  razorfang: { source: 'chapter-15 vendor (2,100)' },
  prismscale: { source: 'Kristiline Town, for the Aquamarine Ore (chapter 8)' },
  electirizer: { source: 'West Gearen babies quest (chapter 9)' },
  magmarizer: { source: 'West Gearen babies quest (chapter 9)' },
  protector: { source: 'Valor Cliffside, for ten Rock types (chapter 10)' },
  blackaugurite: { source: 'Route 8 (chapter 10)' },
  dubiousdisc: { source: 'Darchlight Manor journal (chapter 12); chapter-15 vendor' },
  ovalstone: { source: 'Grand Dream City mushroom trader (chapter 11); chapter-15 vendor' },
  sachet: { source: 'Route 3 stand (1,000)' },
  whippeddream: { source: 'Route 3 stand (1,000)' },
  sweetapple: { source: 'Teila Resort vendor (1,100)' },
  tartapple: { source: 'Teila Resort vendor (1,100)' },
  syrupyapple: { source: 'Grand Dream City vendor (1,100)' },
  galaricacuff: { source: 'Kecleon Bazaar (25,000)' },
  auspiciousarmor: { source: 'one copy: Darchlight Manor battle reward (chapter 10)' },
  maliciousarmor: { source: 'one copy: Darchlight Manor battle reward (chapter 10)' },
  masterpieceteacup: { source: 'Grand Dream City incense shop (19,000)' },
  // Wild holds listed in the walkthrough's appendix.
  kingsrock: { source: 'wild Poliwhirl and Slowbro (5%)' },
  dragonscale: { source: 'wild Horsea and Dratini lines (5%)' },
  deepseatooth: { source: 'wild Carvanha and Sharpedo (5%)' },
  metalcoat: { source: 'wild Magnemite line (5%)' },
});

/**
 * The badge at which each held item first becomes obtainable, with its
 * source.
 * @type {!Object<string, {badge: number, via: string}>}
 */
export const REJUV_ITEM_UNLOCK_BADGES = Object.freeze({
  // East Gearen, before the first badge.
  oranberry: { badge: 0, via: 'Berry Emporium' },
  pechaberry: { badge: 0, via: 'Berry Emporium' },
  heavyball: { badge: 0, via: 'Poké Ball Emporium' },
  moonball: { badge: 0, via: 'Poké Ball Emporium' },
  abilitycapsule: { badge: 0, via: 'Goldenwood Cave briefcase; AP Shop (3 AP)' },
  // Route 2 and Sheridan.
  waterstone: { badge: 1, via: 'Route 2 quest reward' },
  linkheart: { badge: 1, via: 'Kecleon Bazaar (25,000)' },
  duskstone: { badge: 1, via: 'Kecleon Bazaar (25,000)' },
  dawnstone: { badge: 1, via: 'Kecleon Bazaar (25,000)' },
  shinystone: { badge: 1, via: 'Kecleon Bazaar (25,000)' },
  icestone: { badge: 1, via: 'Kecleon Bazaar (25,000)' },
  galaricacuff: { badge: 1, via: 'Kecleon Bazaar (25,000)' },
  magnet: { badge: 1, via: "Route 2 Artist's Quest" },
  protectivepads: { badge: 2, via: 'Chrysalis Manor' },
  moonstone: { badge: 3, via: 'hidden on Route 3' },
  sunstone: { badge: 3, via: 'hidden on Route 3' },
  sachet: { badge: 3, via: 'Route 3 stand (1,000)' },
  whippeddream: { badge: 3, via: 'Route 3 stand (1,000)' },
  // Terajuma Island.
  firestone: { badge: 4, via: 'Lost Camp (2,100)' },
  leafstone: { badge: 4, via: 'Lost Camp (2,100)' },
  reapercloth: { badge: 5, via: 'Weather Institute' },
  weaknesspolicy: { badge: 5, via: 'Help Center, 50 Zygarde Cells' },
  luckyegg: { badge: 5, via: 'Help Center, 50 Zygarde Cells' },
  bigroot: { badge: 5, via: 'hidden in the Akuwa basement' },
  sweetapple: { badge: 6, via: 'Teila Resort vendor (1,100)' },
  tartapple: { badge: 6, via: 'Teila Resort vendor (1,100)' },
  whiteherb: { badge: 6, via: 'Terajuma Beach Herb Shop (100)' },
  powerherb: { badge: 6, via: 'Terajuma Beach Herb Shop (100)' },
  mentalherb: { badge: 6, via: 'Terajuma Beach Herb Shop (100)' },
  razorclaw: { badge: 7, via: 'Kristiline Town' },
  prismscale: { badge: 7, via: 'Kristiline Town, for the Aquamarine Ore' },
  safetygoggles: { badge: 7, via: 'Help Center, 75 Zygarde Cells' },
  // The mainland again.
  electirizer: { badge: 8, via: 'West Gearen babies quest' },
  magmarizer: { badge: 8, via: 'West Gearen babies quest' },
  cellbattery: { badge: 8, via: 'West Gearen Power Plant' },
  protector: { badge: 9, via: 'Valor Cliffside donation' },
  blackaugurite: { badge: 9, via: 'Route 8' },
  auspiciousarmor: { badge: 9, via: 'Darchlight Manor' },
  maliciousarmor: { badge: 9, via: 'Darchlight Manor' },
  syrupyapple: { badge: 9, via: 'Grand Dream City vendor (1,100)' },
  mirrorherb: { badge: 10, via: 'Grand Dream City trash can' },
  heatrock: { badge: 10, via: 'Somniam Mall General Store' },
  icyrock: { badge: 10, via: 'Somniam Mall General Store' },
  ovalstone: { badge: 10, via: 'Grand Dream City mushroom trader' },
  dubiousdisc: { badge: 11, via: 'Darchlight Manor journal' },
  masterpieceteacup: { badge: 11, via: 'Grand Dream City incense shop (19,000)' },
  focussash: { badge: 12, via: 'Hiyoshi City' },
  thunderstone: { badge: 14, via: 'the chapter-15 stone vendor' },
  razorfang: { badge: 14, via: 'the chapter-15 vendor (2,100)' },
  loadeddice: { badge: 14, via: "Shayda's Umbral Shards (New Game+)" },
});

/**
 * Renewable shop stock by the badge at which the shop first sells it: the
 * two Gearen emporiums, the Route 3 stand, Lost Camp, the Terajuma Beach
 * Herb Shop, the Somniam Mall, and the vendors above.
 * @type {!Object<string, number>}
 */
export const REJUV_SHOP_ITEM_BADGES = Object.freeze({
  oranberry: 0,
  pechaberry: 0,
  heavyball: 0,
  moonball: 0,
  abilitycapsule: 0,
  linkheart: 1,
  duskstone: 1,
  dawnstone: 1,
  shinystone: 1,
  icestone: 1,
  waterstone: 1,
  galaricacuff: 1,
  sachet: 3,
  whippeddream: 3,
  firestone: 4,
  leafstone: 4,
  sweetapple: 6,
  tartapple: 6,
  whiteherb: 6,
  powerherb: 6,
  mentalherb: 6,
  syrupyapple: 9,
  heatrock: 10,
  icyrock: 10,
  masterpieceteacup: 11,
  thunderstone: 14,
  razorfang: 14,
  razorclaw: 14,
  ovalstone: 14,
});

/**
 * Rejuvenation-only inventory items outside the Gen 9 held-item catalog
 * that belong in the owned-items tracker. The 67 Crests (held items that
 * rewrite one species' mechanics) are not modeled: the recommender has no
 * prior to price them with.
 * @type {!Array<{id: string, name: string}>}
 */
export const REJUV_EXTRA_INVENTORY_ITEMS = Object.freeze([
  { id: 'linkheart', name: 'Link Heart' },
  // Shared with Reborn: the holder's area-altering moves last 8 turns
  // instead of 5.
  { id: 'amplifieldrock', name: 'Amplifield Rock' },
]);
