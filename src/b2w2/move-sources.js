/**
 * @fileoverview Black 2 and White 2's machines and tutors with pickup timing,
 * in the shape games/legality.js serves (see reborn/progression-options.js).
 * The Generation V TM list is shared by every Gen 5 game; the pickup
 * locations, the HM list, and the tutors are Black 2 and White 2's own
 * (Bulbapedia: "List of TM and HM locations in Generation V", "Move
 * Tutor"; timing from the Black 2 and White 2 walkthrough).
 *
 * `available` is the badge count held when the pickup is normally reached,
 * following the schedule's gym order; a gym's prize TM comes after its
 * badge. Western Unova, Route 8 and beyond, Twist Mountain, and Black
 * City/White Forest open only after the Champion, as do the Battle Subway
 * and PWT prizes, whose BP is no mid-game grind. Machines are reusable in
 * this generation, so no TM carries copy timing.
 */

const MACHINE_AVAILABILITY = {
  tm01: { available: 'After Badge 08', location: 'Victory Road' },
  tm02: { available: 'After the Champion (Badge 08)', location: 'Dragonspiral Tower' },
  tm03: { available: 'After Badge 08', location: 'Giant Chasm' },
  tm04: { available: 'After the Champion (Badge 08)', location: 'Striaton City Poké Mart' },
  tm05: { available: 'After Badge 08', location: 'Route 23' },
  tm06: { available: 'After Badge 08', location: 'Seaside Cave' },
  tm07: { available: 'After Badge 05', location: 'Mistralton City Poké Mart' },
  tm08: { available: 'After the Champion (Badge 08)', location: 'Striaton City Poké Mart' },
  tm09: { available: 'After Badge 02', location: 'Prize for defeating Roxie' },
  tm10: { available: 'After the Champion (Badge 08)', location: 'Battle Subway, PWT' },
  tm11: { available: 'After Badge 05', location: 'Mistralton City Poké Mart' },
  tm12: { available: 'After Badge 08', location: 'Route 23' },
  tm13: { available: 'After Badge 08', location: 'Giant Chasm' },
  tm14: { available: 'After Badge 06', location: 'Lacunosa Town Poké Mart' },
  tm15: { available: 'After Badge 06', location: 'Shopping Mall Nine' },
  tm16: { available: 'After Badge 03', location: 'Nimbasa City Poké Mart' },
  tm17: { available: 'After the Champion (Badge 08)', location: 'Battle Subway, PWT' },
  tm18: { available: 'After Badge 05', location: 'Mistralton City Poké Mart' },
  tm19: { available: 'After the Champion (Badge 08)', location: 'Route 18' },
  tm20: { available: 'After the Champion (Badge 08)', location: 'Battle Subway, PWT' },
  tm21: { available: 'From the start', location: 'From Team Plasma Grunt on Floccesy Ranch' },
  tm22: { available: 'After the Champion (Badge 08)', location: 'Pinwheel Forest' },
  tm23: { available: 'After the Champion (Badge 08)', location: 'Battle Subway, PWT' },
  tm24: { available: 'After Badge 08', location: 'Victory Road' },
  tm25: { available: 'After Badge 06', location: 'Lacunosa Town Poké Mart' },
  tm26: { available: 'After the Champion (Badge 08)', location: 'Route 15' },
  tm27: { available: 'From the start', location: 'Given by Bianca in Aspertia City' },
  tm28: { available: 'After Badge 03', location: 'Route 4' },
  tm29: { available: 'After Badge 06', location: 'Route 13' },
  tm30: { available: 'After Badge 06', location: 'Reversal Mountain' },
  tm31: { available: 'After the Champion (Badge 08)', location: 'Battle Subway, PWT' },
  tm32: { available: 'After the Champion (Badge 08)', location: 'Battle Subway, PWT' },
  tm33: { available: 'After Badge 03', location: 'Nimbasa City Poké Mart' },
  tm34: { available: 'After the Champion (Badge 08)', location: 'Battle Subway, PWT' },
  tm35: { available: 'After Badge 08', location: 'Route 23' },
  tm36: { available: 'After the Champion (Badge 08)', location: 'Route 8' },
  tm37: { available: 'After Badge 05', location: 'Mistralton City Poké Mart' },
  tm38: { available: 'After Badge 06', location: 'Lacunosa Town Poké Mart' },
  tm39: { available: 'After Badge 03', location: 'Relic Castle' },
  tm40: { available: 'After Badge 05', location: 'Mistralton City' },
  tm41: { available: 'After Badge 02', location: 'Castelia Sewers' },
  tm42: { available: 'After Badge 07', location: 'Marine Tube' },
  tm43: { available: 'After the Champion (Badge 08)', location: 'Tubeline Bridge' },
  tm44: { available: 'After Badge 02', location: 'Castelia City' },
  tm45: { available: 'After Badge 02', location: 'Castelia City' },
  tm46: { available: 'After Badge 01', location: 'Virbank Complex' },
  tm47: { available: 'After the Champion (Badge 08)', location: 'Wellspring Cave' },
  tm48: { available: 'After the Champion (Badge 08)', location: 'Battle Subway, PWT' },
  tm49: { available: 'After Badge 03', location: 'Nimbasa City Musical Theater' },
  tm50: { available: 'After the Champion (Badge 08)', location: 'N\'s Castle' },
  tm51: { available: 'After the Champion (Badge 08)', location: 'Battle Subway, PWT' },
  tm52: { available: 'After the Champion (Badge 08)', location: 'Wellspring Cave' },
  tm53: { available: 'After the Champion (Badge 08)', location: 'Aspertia City' },
  tm54: { available: 'After Badge 06', location: 'Reversal Mountain' },
  tm55: { available: 'After Badge 08', location: 'Prize for defeating Marlon' },
  tm56: { available: 'After Badge 05', location: 'Route 6' },
  tm57: { available: 'After Badge 06', location: 'Lentimas Town' },
  tm58: { available: 'After Badge 05', location: 'Mistralton City' },
  tm59: { available: 'After the Champion (Badge 08)', location: 'Battle Subway, PWT' },
  tm60: { available: 'After the Champion (Badge 08)', location: 'Battle Subway, PWT' },
  tm61: { available: 'After Badge 05', location: 'Celestial Tower' },
  tm62: { available: 'After Badge 06', location: 'Prize for defeating Skyla' },
  tm63: { available: 'After Badge 04', location: 'Driftveil City market' },
  tm64: { available: 'After the Champion (Badge 08)', location: 'Battle Subway, PWT' },
  tm65: { available: 'After Badge 05', location: 'Celestial Tower' },
  tm66: { available: 'After Badge 03', location: 'Route 16' },
  tm67: { available: 'After Badge 08', location: 'Plasma Frigate' },
  tm68: { available: 'After Badge 06', location: 'Shopping Mall Nine' },
  tm69: { available: 'After Badge 06', location: 'Reversal Mountain' },
  tm70: { available: 'After Badge 02', location: 'Castelia City' },
  tm71: { available: 'After the Champion (Badge 08)', location: 'Twist Mountain' },
  tm72: { available: 'After Badge 04', location: 'Prize for defeating Elesa' },
  tm73: { available: 'After Badge 03', location: 'Nimbasa City Poké Mart' },
  tm74: { available: 'After Badge 03', location: 'Nimbasa City Poké Mart' },
  tm75: { available: 'After the Champion (Badge 08)', location: 'Battle Subway, PWT' },
  tm76: { available: 'After Badge 03', location: 'Prize for defeating Burgh' },
  tm77: { available: 'After the Champion (Badge 08)', location: 'Battle Subway, PWT' },
  tm78: { available: 'After Badge 05', location: 'Prize for defeating Clay' },
  tm79: { available: 'After the Champion (Badge 08)', location: 'Battle Subway, PWT' },
  tm80: { available: 'After Badge 05', location: 'Mistralton Cave' },
  tm81: { available: 'After Badge 05', location: 'Route 7' },
  tm82: { available: 'After Badge 07', location: 'Prize for defeating Drayden' },
  tm83: { available: 'After Badge 01', location: 'Prize for defeating Cheren' },
  tm84: { available: 'After the Champion (Badge 08)', location: 'Moor of Icirrus' },
  tm85: { available: 'After the Champion (Badge 08)', location: 'Dreamyard' },
  tm86: { available: 'After the Champion (Badge 08)', location: 'Pinwheel Forest' },
  tm87: { available: 'After the Champion (Badge 08)', location: 'Battle Subway, PWT' },
  tm88: { available: 'After the Champion (Badge 08)', location: 'Battle Subway, PWT' },
  tm89: { available: 'After the Champion (Badge 08)', location: 'Battle Subway, PWT' },
  tm90: { available: 'After the Champion (Badge 08)', location: 'Twist Mountain' },
  tm91: { available: 'After the Champion (Badge 08)', location: 'Twist Mountain' },
  tm92: { available: 'After the Champion (Badge 08)', location: 'Abundant Shrine' },
  tm93: { available: 'After Badge 08', location: 'Victory Road' },
  tm94: { available: 'After Badge 01', location: 'Virbank Complex' },
  tm95: { available: 'After Badge 03', location: 'Lostlorn Forest' },
  hm01: { available: 'After Badge 01', location: 'Virbank City' },
  hm02: { available: 'After Badge 04', location: 'Route 5' },
  hm03: { available: 'After Badge 05', location: 'Route 6' },
  hm04: { available: 'After Badge 02', location: 'Castelia Sewers' },
  hm05: { available: 'After Badge 08', location: 'Victory Road' },
  hm06: { available: 'After Badge 06', location: 'Undella Town' },
};

/** The 95 Generation V TMs, sorted by unlock badge then location. */
export const B2W2_TM_OPTIONS = [
  ['tm01', 'TM01', 'Hone Claws'],
  ['tm02', 'TM02', 'Dragon Claw'],
  ['tm03', 'TM03', 'Psyshock'],
  ['tm04', 'TM04', 'Calm Mind'],
  ['tm05', 'TM05', 'Roar'],
  ['tm06', 'TM06', 'Toxic'],
  ['tm07', 'TM07', 'Hail'],
  ['tm08', 'TM08', 'Bulk Up'],
  ['tm09', 'TM09', 'Venoshock'],
  ['tm10', 'TM10', 'Hidden Power'],
  ['tm11', 'TM11', 'Sunny Day'],
  ['tm12', 'TM12', 'Taunt'],
  ['tm13', 'TM13', 'Ice Beam'],
  ['tm14', 'TM14', 'Blizzard'],
  ['tm15', 'TM15', 'Hyper Beam'],
  ['tm16', 'TM16', 'Light Screen'],
  ['tm17', 'TM17', 'Protect'],
  ['tm18', 'TM18', 'Rain Dance'],
  ['tm19', 'TM19', 'Telekinesis'],
  ['tm20', 'TM20', 'Safeguard'],
  ['tm21', 'TM21', 'Frustration'],
  ['tm22', 'TM22', 'Solar Beam'],
  ['tm23', 'TM23', 'Smack Down'],
  ['tm24', 'TM24', 'Thunderbolt'],
  ['tm25', 'TM25', 'Thunder'],
  ['tm26', 'TM26', 'Earthquake'],
  ['tm27', 'TM27', 'Return'],
  ['tm28', 'TM28', 'Dig'],
  ['tm29', 'TM29', 'Psychic'],
  ['tm30', 'TM30', 'Shadow Ball'],
  ['tm31', 'TM31', 'Brick Break'],
  ['tm32', 'TM32', 'Double Team'],
  ['tm33', 'TM33', 'Reflect'],
  ['tm34', 'TM34', 'Sludge Wave'],
  ['tm35', 'TM35', 'Flamethrower'],
  ['tm36', 'TM36', 'Sludge Bomb'],
  ['tm37', 'TM37', 'Sandstorm'],
  ['tm38', 'TM38', 'Fire Blast'],
  ['tm39', 'TM39', 'Rock Tomb'],
  ['tm40', 'TM40', 'Aerial Ace'],
  ['tm41', 'TM41', 'Torment'],
  ['tm42', 'TM42', 'Facade'],
  ['tm43', 'TM43', 'Flame Charge'],
  ['tm44', 'TM44', 'Rest'],
  ['tm45', 'TM45', 'Attract'],
  ['tm46', 'TM46', 'Thief'],
  ['tm47', 'TM47', 'Low Sweep'],
  ['tm48', 'TM48', 'Round'],
  ['tm49', 'TM49', 'Echoed Voice'],
  ['tm50', 'TM50', 'Overheat'],
  ['tm51', 'TM51', 'Ally Switch'],
  ['tm52', 'TM52', 'Focus Blast'],
  ['tm53', 'TM53', 'Energy Ball'],
  ['tm54', 'TM54', 'False Swipe'],
  ['tm55', 'TM55', 'Scald'],
  ['tm56', 'TM56', 'Fling'],
  ['tm57', 'TM57', 'Charge Beam'],
  ['tm58', 'TM58', 'Sky Drop'],
  ['tm59', 'TM59', 'Incinerate'],
  ['tm60', 'TM60', 'Quash'],
  ['tm61', 'TM61', 'Will-O-Wisp'],
  ['tm62', 'TM62', 'Acrobatics'],
  ['tm63', 'TM63', 'Embargo'],
  ['tm64', 'TM64', 'Explosion'],
  ['tm65', 'TM65', 'Shadow Claw'],
  ['tm66', 'TM66', 'Payback'],
  ['tm67', 'TM67', 'Retaliate'],
  ['tm68', 'TM68', 'Giga Impact'],
  ['tm69', 'TM69', 'Rock Polish'],
  ['tm70', 'TM70', 'Flash'],
  ['tm71', 'TM71', 'Stone Edge'],
  ['tm72', 'TM72', 'Volt Switch'],
  ['tm73', 'TM73', 'Thunder Wave'],
  ['tm74', 'TM74', 'Gyro Ball'],
  ['tm75', 'TM75', 'Swords Dance'],
  ['tm76', 'TM76', 'Struggle Bug'],
  ['tm77', 'TM77', 'Psych Up'],
  ['tm78', 'TM78', 'Bulldoze'],
  ['tm79', 'TM79', 'Frost Breath'],
  ['tm80', 'TM80', 'Rock Slide'],
  ['tm81', 'TM81', 'X-Scissor'],
  ['tm82', 'TM82', 'Dragon Tail'],
  ['tm83', 'TM83', 'Work Up'],
  ['tm84', 'TM84', 'Poison Jab'],
  ['tm85', 'TM85', 'Dream Eater'],
  ['tm86', 'TM86', 'Grass Knot'],
  ['tm87', 'TM87', 'Swagger'],
  ['tm88', 'TM88', 'Pluck'],
  ['tm89', 'TM89', 'U-turn'],
  ['tm90', 'TM90', 'Substitute'],
  ['tm91', 'TM91', 'Flash Cannon'],
  ['tm92', 'TM92', 'Trick Room'],
  ['tm93', 'TM93', 'Wild Charge'],
  ['tm94', 'TM94', 'Rock Smash'],
  ['tm95', 'TM95', 'Snarl'],
].map(machineOption).sort(compareMachineAvailability);

/** The six Black 2 and White 2 HMs, same shape and ordering as the TMs. */
export const B2W2_HM_OPTIONS = [
  ['hm01', 'HM01', 'Cut'],
  ['hm02', 'HM02', 'Fly'],
  ['hm03', 'HM03', 'Surf'],
  ['hm04', 'HM04', 'Strength'],
  ['hm05', 'HM05', 'Waterfall'],
  ['hm06', 'HM06', 'Dive'],
].map(machineOption).sort(compareMachineAvailability);

/**
 * Move tutors by NPC, in unlock order. The four shard tutors charge 2 to 12
 * shards of their color per move; shards are hidden items and cave
 * pickups, so the price is a grind but never a wall. Relic Song and Secret
 * Sword tutors serve event Pokémon only and are not listed.
 * @type {!Array<{label: string, available: string, moves: !Array<string>,
 *     options: !Array<{id: string, move: string}>}>}
 */
export const B2W2_TUTOR_GROUPS = [
  {
    label: 'Driftveil City (Red Shards)',
    available: 'After Badge 04',
    moves: [
      'Bounce', 'Bug Bite', 'Covet', 'Drill Run', 'Dual Chop', 'Fire Punch',
      'Gunk Shot', 'Ice Punch', 'Iron Head', 'Low Kick', 'Seed Bomb',
      'Signal Beam', 'Super Fang', 'Thunder Punch', 'Uproar',
    ],
  },
  {
    label: 'Pokémon World Tournament (starters, max friendship)',
    available: 'After Badge 05',
    moves: [
      'Blast Burn', 'Frenzy Plant', 'Hydro Cannon', 'Fire Pledge',
      'Grass Pledge', 'Water Pledge',
    ],
  },
  {
    label: 'Lentimas Town (Blue Shards)',
    available: 'After Badge 06',
    moves: [
      'Aqua Tail', 'Block', 'Dark Pulse', 'Dragon Pulse', 'Earth Power',
      'Electroweb', 'Foul Play', 'Gravity', 'Hyper Voice', 'Icy Wind',
      'Iron Defense', 'Iron Tail', 'Last Resort', 'Magic Coat',
      'Magnet Rise', 'Superpower', 'Zen Headbutt',
    ],
  },
  {
    label: 'Opelucid City (Draco Meteor, max friendship)',
    available: 'After Badge 06',
    moves: ['Draco Meteor'],
  },
  {
    label: 'Humilau City (Yellow Shards)',
    available: 'After Badge 07',
    moves: [
      'Bind', 'Drain Punch', 'Giga Drain', 'Heal Bell', 'Heat Wave',
      'Knock Off', 'Pain Split', 'Role Play', 'Roost', 'Sky Attack', 'Snore',
      'Synthesis', 'Tailwind',
    ],
  },
  {
    label: 'Nacrene City (Green Shards)',
    available: 'After the Champion (Badge 08)',
    moves: [
      'After You', 'Endeavor', 'Gastro Acid', 'Helping Hand', 'Magic Room',
      'Outrage', 'Recycle', 'Skill Swap', 'Sleep Talk', 'Snatch', 'Spite',
      'Stealth Rock', 'Trick', 'Wonder Room', 'Worry Seed',
    ],
  },
].map((group) => ({
  ...group,
  options: group.moves.map((move) => ({ id: toMoveId(move), move })),
}));

/** Every tutor move once. @type {!Array<{id: string, move: string}>} */
export const B2W2_TUTOR_OPTIONS = B2W2_TUTOR_GROUPS.flatMap(
  (group) => group.options,
);

function machineOption([id, code, move]) {
  return { id, code, move, ...MACHINE_AVAILABILITY[id] };
}

function toMoveId(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function compareMachineAvailability(a, b) {
  return (
    badgeOrder(a.available) - badgeOrder(b.available) ||
    String(a.location || '').localeCompare(String(b.location || '')) ||
    a.code.localeCompare(b.code, undefined, { numeric: true })
  );
}

function badgeOrder(available) {
  const text = String(available || '');
  if (/^From the start/i.test(text)) return 0;
  const match = text.match(/Badge\s+(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : 999;
}
