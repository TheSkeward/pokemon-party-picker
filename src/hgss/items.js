/**
 * @fileoverview HGSS's item content, curated by hand from Bulbapedia's
 * per-item acquisition tables (HGSS rows), the Pokéathlon Dome's Athlete
 * Shop, and the Battle Frontier's Exchange Service Corner, in the shapes
 * games/items.js and games/schedule.js read. Every entry says where it comes
 * from; anything absent is unknown, and the engine surfaces it as such.
 *
 * Badges follow the schedule's gym order (hgss/schedule.js): the count
 * held when a location is normally reached. Kanto opens after the eighth
 * badge, so a Kanto pickup before any Kanto gym is badge 8; the Battle
 * Frontier is placed at 8 as well, since its BP prices are no mid-game grind.
 * Weather rocks, the pinch berries, and the event orbs are absent: HGSS
 * offers them only by trade, Pokéwalker, or event, so they stay untracked.
 */

/**
 * Evolution items. `farmable` means a reliable source at its badge (a fixed
 * pickup, a shop, a gift, or a 50% wild hold); `farmable-tedious` means a
 * real grind (5% wild holds only, or a 48 BP Frontier price).
 * @type {!Object<string, {status: string, source: string}>}
 */
export const HGSS_EVOLUTION_ITEM_AVAILABILITY = Object.freeze({
  // The Athlete Shop sells one a day from the National Park on; the phone
  // gift trainers and Bill's grandfather add copies.
  firestone: { status: 'farmable', source: 'Athlete Shop (Tuesday), Alan on Route 36, Bill\'s grandfather' },
  waterstone: { status: 'farmable', source: 'Athlete Shop (Wednesday), Tully on Route 42, Bill\'s grandfather' },
  thunderstone: { status: 'farmable', source: 'Athlete Shop (Thursday), Dana on Route 38, Bill\'s grandfather' },
  leafstone: { status: 'farmable', source: 'Athlete Shop (Saturday), Gina on Route 34, Bill\'s grandfather' },
  moonstone: { status: 'farmable', source: 'Athlete Shop (Monday), Ruins of Alph, Tohjo Falls, wild Clefairy (5%)' },
  // Post-National Dex only: the Athlete Shop stocks them in Kanto, and a
  // Kanto phone trainer gives each.
  sunstone: { status: 'farmable', source: 'Athlete Shop after the National Dex, Tanner on Route 13' },
  shinystone: { status: 'farmable', source: 'National Park, Athlete Shop after the National Dex, Josh on Route 14' },
  duskstone: { status: 'farmable', source: 'Athlete Shop after the National Dex, Reese on Route 17, Cerulean Cave' },
  dawnstone: { status: 'farmable', source: 'Athlete Shop after the National Dex, Aiden on Route 17, Mt. Silver Cave' },
  metalcoat: { status: 'farmable', source: 'Athlete Shop (Friday), S.S. Aqua, wild Magnemite line (5%)' },
  kingsrock: { status: 'farmable', source: 'Slowpoke Well, Athlete Shop (Sunday), wild Poliwhirl and Slowbro (5%)' },
  dragonscale: { status: 'farmable', source: 'Mt. Mortar, Athlete Shop after the National Dex, wild Horsea and Dratini lines (5%)' },
  ovalstone: { status: 'farmable', source: 'Rock Tunnel, wild Chansey (50%)' },
  // One fixed copy each.
  upgrade: { status: 'farmable', source: 'one copy: Silph Co.' },
  deepseatooth: { status: 'farmable', source: 'one copy: Route 20' },
  deepseascale: { status: 'farmable', source: 'Route 20, wild Chinchou line (5%)' },
  protector: { status: 'farmable', source: 'one copy: Mt. Mortar' },
  electirizer: { status: 'farmable', source: 'one copy: Cerulean Cave' },
  magmarizer: { status: 'farmable', source: 'one copy: Cinnabar Island' },
  dubiousdisc: { status: 'farmable', source: 'one copy: Route 42' },
  reapercloth: { status: 'farmable', source: 'one copy: Mt. Silver' },
  razorclaw: { status: 'farmable-tedious', source: 'Battle Frontier (48 BP)' },
  razorfang: { status: 'farmable-tedious', source: 'Battle Frontier (48 BP)' },
});

/**
 * The badge at which each held item first becomes obtainable, with its
 * source. Fixed pickups name their location; renewable sources their shop
 * or holder.
 * @type {!Object<string, {badge: number, via: string}>}
 */
export const HGSS_ITEM_UNLOCK_BADGES = Object.freeze({
  // Johto, before the League.
  mysticwater: { badge: 0, via: 'Cherrygrove City' },
  twistedspoon: { badge: 0, via: 'Route 29 (Tuesday)' },
  oranberry: { badge: 0, via: 'Route 36, Violet City' },
  lifeorb: { badge: 1, via: 'Ruins of Alph (Flash puzzle)' },
  sitrusberry: { badge: 1, via: 'Ruins of Alph, Violet City' },
  lumberry: { badge: 1, via: 'Violet City' },
  chestoberry: { badge: 1, via: 'Routes 31 and 34' },
  leppaberry: { badge: 1, via: 'Ruins of Alph' },
  blackglasses: { badge: 1, via: 'Dark Cave' },
  shellbell: { badge: 1, via: 'Route 32' },
  miracleseed: { badge: 1, via: 'Route 32' },
  poisonbarb: { badge: 1, via: 'Route 32 (Friday)' },
  hardstone: { badge: 1, via: 'Route 36 (Thursday)' },
  moonstone: { badge: 1, via: 'Ruins of Alph' },
  quickclaw: { badge: 2, via: 'National Park' },
  shinystone: { badge: 2, via: 'National Park' },
  powerherb: { badge: 2, via: 'Route 34' },
  charcoal: { badge: 2, via: 'Azalea Town charcoal kiln' },
  machobrace: { badge: 2, via: 'Goldenrod in-game trade (Machop)' },
  shedshell: { badge: 2, via: 'Bug-Catching Contest consolation prize' },
  quickpowder: { badge: 2, via: 'wild Ditto (50%)' },
  metalpowder: { badge: 2, via: 'wild Ditto (5%)' },
  silverpowder: { badge: 2, via: 'wild Butterfree (5%)' },
  widelens: { badge: 2, via: 'Goldenrod Game Corner' },
  zoomlens: { badge: 2, via: 'Goldenrod Game Corner' },
  silkscarf: { badge: 2, via: 'Goldenrod Game Corner' },
  metronome: { badge: 2, via: 'Goldenrod Game Corner' },
  firestone: { badge: 2, via: 'Athlete Shop (Tuesday)' },
  waterstone: { badge: 2, via: 'Athlete Shop (Wednesday)' },
  thunderstone: { badge: 2, via: 'Athlete Shop (Thursday)' },
  leafstone: { badge: 2, via: 'Athlete Shop (Saturday)' },
  metalcoat: { badge: 2, via: 'Athlete Shop (Friday)' },
  kingsrock: { badge: 2, via: 'Athlete Shop (Sunday)' },
  magnet: { badge: 3, via: 'Route 37 (Sunday)' },
  cheriberry: { badge: 4, via: 'Olivine City' },
  laxincense: { badge: 4, via: 'Route 38' },
  sharpbeak: { badge: 4, via: 'Route 40 (Monday)' },
  stick: { badge: 4, via: 'wild Farfetch\'d (5%)' },
  laggingtail: { badge: 5, via: 'Route 47' },
  waveincense: { badge: 5, via: 'Route 47' },
  choicespecs: { badge: 6, via: 'Lake of Rage' },
  blackbelt: { badge: 6, via: 'Lake of Rage (Wednesday)' },
  ironball: { badge: 6, via: 'Mt. Mortar' },
  fullincense: { badge: 6, via: 'Mt. Mortar' },
  dragonscale: { badge: 6, via: 'Mt. Mortar' },
  protector: { badge: 6, via: 'Mt. Mortar' },
  dubiousdisc: { badge: 6, via: 'Route 42' },
  brightpowder: { badge: 7, via: 'Goldenrod Radio Tower' },
  nevermeltice: { badge: 7, via: 'Ice Path' },
  softsand: { badge: 7, via: 'Blackthorn City (Saturday)' },
  dragonfang: { badge: 8, via: 'Dragon\'s Den' },
  destinyknot: { badge: 8, via: 'Route 27' },
  // The Battle Frontier and the Kanto arrival.
  choiceband: { badge: 8, via: 'Battle Frontier (48 BP)' },
  choicescarf: { badge: 8, via: 'Battle Frontier (48 BP)' },
  focussash: { badge: 8, via: 'Battle Frontier (48 BP)' },
  focusband: { badge: 8, via: 'Battle Frontier (48 BP)' },
  scopelens: { badge: 8, via: 'Battle Frontier (48 BP)' },
  muscleband: { badge: 8, via: 'Battle Frontier (48 BP)' },
  razorclaw: { badge: 8, via: 'Battle Frontier (48 BP)' },
  razorfang: { badge: 8, via: 'Battle Frontier (48 BP)' },
  whiteherb: { badge: 8, via: 'Battle Frontier (32 BP)' },
  toxicorb: { badge: 8, via: 'Battle Frontier (16 BP)' },
  flameorb: { badge: 8, via: 'Battle Frontier (16 BP)' },
  occaberry: { badge: 8, via: 'Battle Frontier scratch-off cards' },
  passhoberry: { badge: 8, via: 'Battle Frontier scratch-off cards' },
  wacanberry: { badge: 8, via: 'Battle Frontier scratch-off cards' },
  yacheberry: { badge: 8, via: 'Battle Frontier scratch-off cards' },
  chopleberry: { badge: 8, via: 'Battle Frontier scratch-off cards' },
  shucaberry: { badge: 8, via: 'Battle Frontier scratch-off cards' },
  colburberry: { badge: 8, via: 'Battle Frontier scratch-off cards' },
  babiriberry: { badge: 8, via: 'Battle Frontier scratch-off cards' },
  chartiberry: { badge: 8, via: 'Battle Frontier scratch-off cards' },
  sunstone: { badge: 8, via: 'Athlete Shop after the National Dex' },
  duskstone: { badge: 8, via: 'Athlete Shop after the National Dex' },
  dawnstone: { badge: 8, via: 'Athlete Shop after the National Dex' },
  stickybarb: { badge: 8, via: 'Vermilion City' },
  upgrade: { badge: 9, via: 'Silph Co.' },
  rockincense: { badge: 9, via: 'Diglett\'s Cave' },
  lightclay: { badge: 10, via: 'Route 9' },
  mentalherb: { badge: 10, via: 'Route 7' },
  ovalstone: { badge: 10, via: 'Rock Tunnel' },
  thickclub: { badge: 10, via: 'wild Cubone and Marowak (5%)' },
  leftovers: { badge: 11, via: 'the Route 11 Snorlax (100%)' },
  spelltag: { badge: 11, via: 'Celadon Condominiums' },
  blacksludge: { badge: 12, via: 'Route 17 (Dale\'s Gulpin), Cerulean Cave' },
  bigroot: { badge: 13, via: 'Route 3' },
  wiseglasses: { badge: 13, via: 'Pewter City' },
  luckypunch: { badge: 13, via: 'Route 14' },
  roseincense: { badge: 13, via: 'Route 15' },
  lightball: { badge: 14, via: 'wild Pikachu in Viridian Forest (5%)' },
  gripclaw: { badge: 14, via: 'Seafoam Islands' },
  magmarizer: { badge: 14, via: 'Cinnabar Island' },
  deepseatooth: { badge: 14, via: 'Route 20' },
  deepseascale: { badge: 14, via: 'Route 20' },
  // After the sixteenth badge.
  expertbelt: { badge: 16, via: 'Mt. Silver Cave' },
  reapercloth: { badge: 16, via: 'Mt. Silver' },
  electirizer: { badge: 16, via: 'Cerulean Cave' },
  seaincense: { badge: 16, via: 'Cerulean Cave' },
  oddincense: { badge: 16, via: 'Cerulean Cave' },
  fistplate: { badge: 16, via: 'S.S. Aqua captain' },
  icicleplate: { badge: 16, via: 'S.S. Aqua captain' },
  earthplate: { badge: 16, via: 'S.S. Aqua captain' },
  mindplate: { badge: 16, via: 'S.S. Aqua captain' },
  flameplate: { badge: 16, via: 'S.S. Aqua captain' },
  meadowplate: { badge: 16, via: 'S.S. Aqua captain' },
  splashplate: { badge: 16, via: 'S.S. Aqua captain' },
  dreadplate: { badge: 16, via: 'S.S. Aqua captain' },
});

/**
 * Renewable purchases by first badge: the Athlete Shop (one a day, some only
 * after the National Dex), the Game Corners, and the Frontier's BP counter.
 * @type {!Object<string, number>}
 */
export const HGSS_SHOP_ITEM_BADGES = Object.freeze({
  firestone: 2,
  waterstone: 2,
  thunderstone: 2,
  leafstone: 2,
  moonstone: 2,
  metalcoat: 2,
  kingsrock: 2,
  widelens: 2,
  zoomlens: 2,
  silkscarf: 2,
  metronome: 2,
  sunstone: 8,
  shinystone: 8,
  duskstone: 8,
  dawnstone: 8,
  dragonscale: 8,
  toxicorb: 8,
  flameorb: 8,
  whiteherb: 8,
  powerherb: 8,
  brightpowder: 8,
  focusband: 8,
  focussash: 8,
  choiceband: 8,
  choicescarf: 8,
  scopelens: 8,
  muscleband: 8,
  razorclaw: 8,
  razorfang: 8,
});

/**
 * Evolution items the Gen 4 usage catalog lacks (no competitive set holds
 * them), listed so the inventory tracker can record them: an owned item
 * overrides its access gate.
 * @type {!Array<{id: string, name: string}>}
 */
export const HGSS_EXTRA_INVENTORY_ITEMS = Object.freeze([
  { id: 'dawnstone', name: 'Dawn Stone' },
  { id: 'protector', name: 'Protector' },
  { id: 'dubiousdisc', name: 'Dubious Disc' },
  { id: 'reapercloth', name: 'Reaper Cloth' },
]);
