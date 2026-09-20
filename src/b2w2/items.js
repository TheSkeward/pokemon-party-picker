/**
 * @fileoverview Black 2 and White 2's item content, curated by hand from
 * Bulbapedia's per-item acquisition tables (B2W2 rows), in the shapes
 * games/items.js and games/schedule.js read. Every entry says where it
 * comes from; anything absent is unknown, and the engine surfaces it as
 * such.
 *
 * Badges follow the schedule's gym order (b2w2/schedule.js): the count held
 * when a location is normally reached. Western Unova, Route 8 and beyond,
 * Twist Mountain, Clay Tunnel, and Black City / White Forest open after the
 * Champion, so their pickups are badge 8, as are the Battle Subway and PWT
 * prizes (BP is no mid-game grind). Join Avenue opens at badge 3 and its
 * shops are staffed by in-game visitors, so it counts as a source, a slow
 * one. Funfest Missions (Entralink), Pickup, and dust-cloud drops are
 * chance and stay untracked; version-exclusive pickups name their version.
 */

/**
 * Evolution items. `farmable` means a reliable source at its badge (a fixed
 * pickup, a shop, a gift, or a 50% wild hold); `farmable-tedious` means a
 * real grind (5% wild holds or a Join Avenue shop only).
 * @type {!Object<string, {status: string, source: string}>}
 */
export const B2W2_EVOLUTION_ITEM_AVAILABILITY = Object.freeze({
  // The Battle Subway and PWT sell the four classic stones for 3 BP, the
  // cheapest prize there is; Black City and White Forest stock stones after
  // the Champion.
  firestone: { status: 'farmable', source: 'Desert Resort, Lentimas Town, Battle Subway/PWT (3 BP), Black City' },
  waterstone: { status: 'farmable', source: 'Route 19, Clay Tunnel, Battle Subway/PWT (3 BP), White Forest' },
  thunderstone: { status: 'farmable', source: 'Nimbasa City, Chargestone Cave, Battle Subway/PWT (3 BP), Black City' },
  leafstone: { status: 'farmable', source: 'Route 7, Lostlorn Forest, Battle Subway/PWT (3 BP), White Forest' },
  moonstone: { status: 'farmable', source: 'Route 6, Giant Chasm, wild Clefairy line and Lunatone (5%)' },
  sunstone: { status: 'farmable', source: 'Nimbasa City, Relic Castle, Giant Chasm, Pinwheel Forest, wild Solrock (5%)' },
  shinystone: { status: 'farmable', source: 'Route 6, Undella Town, Abundant Shrine, Dragonspiral Tower, White Forest' },
  duskstone: { status: 'farmable', source: 'Strange House, Victory Road, Twist Mountain, Black City' },
  dawnstone: { status: 'farmable', source: 'Route 2, Dreamyard, Moor of Icirrus, Black City' },
  metalcoat: { status: 'farmable', source: 'Chargestone Cave, Clay Tunnel, Black City, wild Magnemite and Bronzor lines (5%)' },
  kingsrock: { status: 'farmable', source: 'Nuvema Town, Icirrus City, White Forest, wild Poliwhirl line (5%)' },
  dragonscale: { status: 'farmable', source: 'Victory Road, White Forest, wild Horsea and Dratini lines (5%)' },
  upgrade: { status: 'farmable', source: 'Pinwheel Forest, Striaton City, Black City' },
  prismscale: { status: 'farmable', source: 'Route 1, Undella Town, Route 18 (hidden, recurring)' },
  // One fixed copy each; the Frigate's is version-exclusive.
  protector: { status: 'farmable', source: 'one copy: Wellspring Cave; Black City' },
  electirizer: { status: 'farmable', source: 'one copy: Plasma Frigate (White 2; Black 2 gets the Magmarizer), else Join Avenue' },
  magmarizer: { status: 'farmable', source: 'one copy: Plasma Frigate (Black 2; White 2 gets the Electirizer), else Join Avenue' },
  dubiousdisc: { status: 'farmable', source: 'one copy: P2 Laboratory; Black City' },
  reapercloth: { status: 'farmable', source: 'one copy: Dreamyard; Join Avenue' },
  razorclaw: { status: 'farmable', source: 'Giant Chasm, Battle Subway/PWT (8 BP)' },
  razorfang: { status: 'farmable', source: 'Route 11, Battle Subway/PWT (8 BP)' },
  // No fixed copy: wild holds, a store, or dust clouds only.
  deepseatooth: { status: 'farmable-tedious', source: 'wild Carvanha line and Red-Striped Basculin (5%), White Forest' },
  deepseascale: { status: 'farmable-tedious', source: 'wild Chinchou line, Relicanth, and Blue-Striped Basculin (5%), White Forest' },
  ovalstone: { status: 'farmable-tedious', source: 'dust clouds in caves, White Forest' },
});

/**
 * The badge at which each held item first becomes obtainable, with its
 * source. Fixed pickups name their location; renewable sources their shop
 * or holder.
 * @type {!Object<string, {badge: number, via: string}>}
 */
export const B2W2_ITEM_UNLOCK_BADGES = Object.freeze({
  // Before the League, gym by gym.
  expertbelt: { badge: 0, via: 'Route 19' },
  oranberry: { badge: 0, via: 'Route 19' },
  leppaberry: { badge: 0, via: 'Route 20' },
  sitrusberry: { badge: 0, via: 'Route 20, Village Bridge' },
  stickybarb: { badge: 0, via: 'Route 20' },
  silkscarf: { badge: 1, via: 'Virbank Complex' },
  leftovers: { badge: 2, via: 'Castelia Sewers' },
  eviolite: { badge: 2, via: 'Castelia City' },
  blacksludge: { badge: 2, via: 'Castelia Sewers, Marine Tube' },
  twistedspoon: { badge: 2, via: 'Castelia Sewers' },
  poisongem: { badge: 2, via: 'Castelia Sewers' },
  scopelens: { badge: 2, via: 'Castelia City' },
  blackglasses: { badge: 2, via: 'Castelia City' },
  charcoal: { badge: 2, via: 'Castelia City' },
  mysticwater: { badge: 2, via: 'Castelia City, Route 4' },
  miracleseed: { badge: 2, via: 'Castelia City' },
  destinyknot: { badge: 2, via: 'Castelia City' },
  quickclaw: { badge: 2, via: 'Skyarrow Bridge' },
  softsand: { badge: 3, via: 'Desert Resort' },
  groundgem: { badge: 3, via: 'Desert Resort' },
  grassgem: { badge: 3, via: 'Lostlorn Forest' },
  cheriberry: { badge: 3, via: 'Lostlorn Forest, Route 5' },
  machobrace: { badge: 3, via: 'Nimbasa City (east gate)' },
  brightpowder: { badge: 3, via: 'Anville Town, Route 4 (White 2)' },
  widelens: { badge: 3, via: 'Route 4 (Black 2), wild Yanma line (5%)' },
  lightclay: { badge: 3, via: 'Route 4 (White 2), wild Golurk (5%)' },
  gripclaw: { badge: 3, via: 'Route 4 (Black 2), wild Sneasel (50%)' },
  shedshell: { badge: 3, via: 'wild Scraggy line (5%)' },
  mentalherb: { badge: 3, via: 'wild Sewaddle line (5%)' },
  // Join Avenue's Flower Shop, once a visitor opens one.
  salacberry: { badge: 3, via: 'Join Avenue (Flower Shop)' },
  liechiberry: { badge: 3, via: 'Join Avenue (Flower Shop)' },
  petayaberry: { badge: 3, via: 'Join Avenue (Flower Shop)' },
  apicotberry: { badge: 3, via: 'Join Avenue (Flower Shop)' },
  ganlonberry: { badge: 3, via: 'Join Avenue (Flower Shop)' },
  occaberry: { badge: 3, via: 'Join Avenue (Flower Shop), wild Pansage (5%)' },
  passhoberry: { badge: 3, via: 'Join Avenue (Flower Shop), wild Pansear (5%)' },
  wacanberry: { badge: 3, via: 'Join Avenue (Flower Shop)' },
  yacheberry: { badge: 3, via: 'Join Avenue (Flower Shop)' },
  chopleberry: { badge: 3, via: 'Join Avenue (Flower Shop)' },
  shucaberry: { badge: 3, via: 'Join Avenue (Flower Shop)' },
  babiriberry: { badge: 3, via: 'Join Avenue (Flower Shop)' },
  chartiberry: { badge: 3, via: 'Join Avenue (Flower Shop), wild Swellow (5%)' },
  colburberry: { badge: 3, via: 'Join Avenue (Flower Shop)' },
  shellbell: { badge: 4, via: 'Driftveil City, Humilau City' },
  bigroot: { badge: 4, via: 'Driftveil City' },
  airballoon: { badge: 4, via: 'Driftveil City' },
  laxincense: { badge: 4, via: 'Driftveil Market' },
  seaincense: { badge: 4, via: 'Driftveil Market' },
  waveincense: { badge: 4, via: 'Driftveil Market' },
  oddincense: { badge: 4, via: 'Driftveil Market' },
  rockincense: { badge: 4, via: 'Driftveil Market' },
  roseincense: { badge: 4, via: 'Driftveil Market' },
  fullincense: { badge: 4, via: 'Driftveil Market' },
  rockyhelmet: { badge: 5, via: 'Pokémon World Tournament, Relic Passage' },
  hardstone: { badge: 5, via: 'Relic Passage' },
  rockgem: { badge: 5, via: 'Relic Passage' },
  chestoberry: { badge: 5, via: 'Chargestone Cave' },
  magnet: { badge: 5, via: 'Chargestone Cave' },
  electricgem: { badge: 5, via: 'Chargestone Cave' },
  dragongem: { badge: 5, via: 'Mistralton Cave' },
  sharpbeak: { badge: 5, via: 'Mistralton City' },
  flyinggem: { badge: 5, via: 'Mistralton City' },
  ghostgem: { badge: 5, via: 'Celestial Tower' },
  spelltag: { badge: 6, via: 'Lentimas Town, Strange House' },
  toxicorb: { badge: 6, via: 'Reversal Mountain (Black 2), Battle Subway/PWT (16 BP)' },
  flameorb: { badge: 6, via: 'Reversal Mountain (White 2), Battle Subway/PWT (16 BP)' },
  watergem: { badge: 6, via: 'Reversal Mountain (Black 2)' },
  firegem: { badge: 6, via: 'Reversal Mountain (White 2)' },
  berryjuice: { badge: 6, via: 'Undella Town, Nuvema Town' },
  metronome: { badge: 6, via: 'Lacunosa Town, Accumula Town' },
  floatstone: { badge: 6, via: 'Opelucid City, Twist Mountain' },
  ringtarget: { badge: 6, via: 'Opelucid City' },
  darkgem: { badge: 6, via: 'Route 9' },
  fistplate: { badge: 6, via: 'Abyssal Ruins' },
  icicleplate: { badge: 6, via: 'Abyssal Ruins' },
  earthplate: { badge: 6, via: 'Abyssal Ruins' },
  mindplate: { badge: 6, via: 'Abyssal Ruins' },
  flameplate: { badge: 6, via: 'Abyssal Ruins' },
  poisonbarb: { badge: 8, via: 'Route 22' },
  icegem: { badge: 8, via: 'Giant Chasm' },
  quickpowder: { badge: 8, via: 'wild Ditto (50%, Giant Chasm)' },
  metalpowder: { badge: 8, via: 'wild Ditto (5%, Giant Chasm)' },
  dragonfang: { badge: 8, via: 'Victory Road' },
  normalgem: { badge: 8, via: 'Victory Road' },
  // After the Champion: the rest of Unova and the BP prizes.
  lifeorb: { badge: 8, via: 'Battle Subway/PWT (24 BP)' },
  focussash: { badge: 8, via: 'Battle Subway/PWT (24 BP)' },
  choiceband: { badge: 8, via: 'Battle Subway/PWT (24 BP)' },
  choicescarf: { badge: 8, via: 'Battle Subway/PWT (24 BP)' },
  choicespecs: { badge: 8, via: 'Battle Subway/PWT (24 BP)' },
  powerherb: { badge: 8, via: 'Battle Subway/PWT (16 BP)' },
  whiteherb: { badge: 8, via: 'Battle Subway/PWT (16 BP)' },
  redcard: { badge: 8, via: 'Battle Subway/PWT (16 BP)' },
  absorbbulb: { badge: 8, via: 'Battle Subway/PWT (16 BP)' },
  cellbattery: { badge: 8, via: 'Battle Subway/PWT (16 BP)' },
  ejectbutton: { badge: 8, via: 'Twist Mountain, Battle Subway/PWT (16 BP)' },
  focusband: { badge: 8, via: 'Battle Subway/PWT (12 BP)' },
  zoomlens: { badge: 8, via: 'Battle Subway/PWT (12 BP)' },
  ironball: { badge: 8, via: 'Battle Subway/PWT (12 BP)' },
  muscleband: { badge: 8, via: 'Battle Subway/PWT (8 BP)' },
  wiseglasses: { badge: 8, via: 'Battle Subway/PWT (8 BP)' },
  bindingband: { badge: 8, via: 'Battle Subway/PWT (8 BP)' },
  lumberry: { badge: 8, via: 'Route 1, Pinwheel Forest, Moor of Icirrus, Clay Tunnel' },
  damprock: { badge: 8, via: 'Route 8 (once a day, morning)' },
  heatrock: { badge: 8, via: 'Route 8 (once a day, daytime)' },
  smoothrock: { badge: 8, via: 'Route 8 (once a day, evening)' },
  icyrock: { badge: 8, via: 'Route 8 (once a day, night)' },
  blackbelt: { badge: 8, via: 'Icirrus City, wild Throh and Sawk (5%)' },
  nevermeltice: { badge: 8, via: 'Dragonspiral Tower' },
  griseousorb: { badge: 8, via: 'Dragonspiral Tower' },
  adamantorb: { badge: 8, via: 'Dragonspiral Tower' },
  lustrousorb: { badge: 8, via: 'Dragonspiral Tower' },
  souldew: { badge: 8, via: 'Dreamyard (after the Latias or Latios battle)' },
  psychicgem: { badge: 8, via: 'Dreamyard' },
  fightinggem: { badge: 8, via: 'Pinwheel Forest' },
  buggem: { badge: 8, via: 'Pinwheel Forest' },
  steelgem: { badge: 8, via: 'Clay Tunnel' },
  silverpowder: { badge: 8, via: 'wild Volcarona (100%, Relic Castle)' },
});

/**
 * Renewable purchases by first badge: the Battle Subway and PWT prize
 * counters (BP, placed after the Champion) and the Black City / White
 * Forest stores. The Driftveil Market's incenses are stocked from badge 4.
 * @type {!Object<string, number>}
 */
export const B2W2_SHOP_ITEM_BADGES = Object.freeze({
  laxincense: 4,
  seaincense: 4,
  waveincense: 4,
  oddincense: 4,
  rockincense: 4,
  roseincense: 4,
  fullincense: 4,
  firestone: 8,
  waterstone: 8,
  thunderstone: 8,
  leafstone: 8,
  shinystone: 8,
  duskstone: 8,
  dawnstone: 8,
  metalcoat: 8,
  kingsrock: 8,
  dragonscale: 8,
  upgrade: 8,
  protector: 8,
  dubiousdisc: 8,
  deepseatooth: 8,
  deepseascale: 8,
  ovalstone: 8,
  razorclaw: 8,
  razorfang: 8,
  lifeorb: 8,
  focussash: 8,
  choiceband: 8,
  choicescarf: 8,
  choicespecs: 8,
  powerherb: 8,
  whiteherb: 8,
  redcard: 8,
  absorbbulb: 8,
  cellbattery: 8,
  ejectbutton: 8,
  toxicorb: 8,
  flameorb: 8,
  airballoon: 8,
  brightpowder: 8,
  focusband: 8,
  zoomlens: 8,
  ironball: 8,
  muscleband: 8,
  wiseglasses: 8,
  scopelens: 8,
  widelens: 8,
  bindingband: 8,
});

/**
 * Evolution items the Gen 5 usage catalog lacks (no competitive set holds
 * them), listed so the inventory tracker can record them: an owned item
 * overrides its access gate.
 * @type {!Array<{id: string, name: string}>}
 */
export const B2W2_EXTRA_INVENTORY_ITEMS = Object.freeze([
  { id: 'dubiousdisc', name: 'Dubious Disc' },
  { id: 'prismscale', name: 'Prism Scale' },
]);
