/**
 * @fileoverview SoulSilver's machines and tutors with pickup timing, in the
 * shape games/legality.js serves (see reborn/progression-options.js). The
 * Generation IV TM list is shared by every Gen 4 game; the HM list, the
 * pickup locations, and the tutors are HeartGold/SoulSilver's own
 * (Bulbapedia: "List of TM and HM locations in Generation IV", "Move
 * Tutor").
 *
 * `available` is the badge count held when the pickup is normally reached,
 * following the schedule's gym order; Battle Frontier prizes are placed
 * after the Johto run because their BP cost is not a mid-game grind. A
 * machine whose only source is the Goldenrod lottery carries no timing.
 * Pokéwalker pickups are not counted.
 */

const MACHINE_AVAILABILITY = {
  tm01: { available: 'After Badge 05', location: 'Chuck (Cianwood Gym)' },
  tm02: { available: 'After Badge 08', location: 'Route 27' },
  tm03: { available: 'After Badge 11', location: 'Misty (Cerulean Gym)' },
  tm04: { available: 'After Badge 08', location: 'Battle Frontier (48 BP)' },
  tm05: { available: 'After Badge 01', location: 'Route 32' },
  tm06: { available: 'After Badge 08', location: 'Battle Frontier (32 BP)' },
  tm07: { available: 'After Badge 07', location: 'Pryce (Mahogany Gym)' },
  tm08: { available: 'After Badge 08', location: 'Battle Frontier (48 BP)' },
  tm09: { available: 'After Badge 01', location: 'Route 32' },
  tm10: { available: 'After Badge 06', location: 'Lake of Rage' },
  tm11: { available: 'After Badge 07', location: 'Goldenrod Radio Tower' },
  tm12: { available: 'After Badge 02', location: 'Route 34 gate' },
  tm13: { available: 'After Badge 02', location: 'Goldenrod Game Corner' },
  tm14: { available: 'After Badge 02', location: 'Goldenrod Department Store' },
  tm15: { available: 'After Badge 02', location: 'Goldenrod Department Store' },
  tm16: { available: 'After Badge 02', location: 'Goldenrod Department Store' },
  tm17: { available: 'After Badge 02', location: 'Goldenrod Department Store' },
  tm18: { available: 'After Badge 04', location: 'Slowpoke Well (Surf, Strength)' },
  tm19: { available: 'After Badge 12', location: 'Erika (Celadon Gym)' },
  tm20: { available: 'After Badge 11', location: 'Celadon Department Store' },
  tm21: { available: 'After Badge 11', location: 'Celadon Department Store' },
  tm22: { available: 'After Badge 02', location: 'Goldenrod Department Store' },
  tm23: { available: 'After Badge 06', location: 'Jasmine (Olivine Gym)' },
  tm24: { available: 'After Badge 02', location: 'Goldenrod Game Corner' },
  tm25: { available: 'After Badge 02', location: 'Goldenrod Department Store' },
  tm26: { available: 'After Badge 08', location: 'Victory Road' },
  tm27: { available: 'After Badge 02', location: 'Goldenrod Department Store' },
  tm28: { available: 'After Badge 02', location: 'National Park' },
  tm29: { available: 'After Badge 09', location: 'Saffron City' },
  tm30: { available: 'After Badge 04', location: 'Morty (Ecruteak Gym)' },
  tm31: { available: 'After Badge 08', location: 'Battle Frontier (40 BP)' },
  tm32: { available: 'After Badge 11', location: 'Celadon Game Corner' },
  tm33: { available: 'After Badge 02', location: 'Goldenrod Department Store' },
  tm34: { available: 'After Badge 09', location: 'Lt. Surge (Vermilion Gym)' },
  tm35: { available: 'After Badge 02', location: 'Goldenrod Game Corner' },
  tm36: { available: 'After Badge 06', location: 'Route 43' },
  tm37: { available: 'After Badge 08', location: 'Route 27' },
  tm38: { available: 'After Badge 02', location: 'Goldenrod Department Store' },
  tm39: { available: 'After Badge 01', location: 'Union Cave' },
  tm40: { available: 'After Badge 06', location: 'Mt. Mortar' },
  tm41: { available: 'After Badge 10', location: 'Route 8' },
  tm42: { location: 'Goldenrod Department Store lottery' },
  tm43: { available: 'After Badge 06', location: 'Lake of Rage' },
  tm44: { available: 'After Badge 02', location: 'Goldenrod Game Corner' },
  tm45: { available: 'After Badge 03', location: 'Whitney (Goldenrod Gym)' },
  tm46: { available: 'After Badge 06', location: 'Team Rocket HQ' },
  tm47: { available: 'After Badge 16', location: 'Route 28' },
  tm48: { available: 'After Badge 10', location: 'Sabrina (Saffron Gym)' },
  tm49: { available: 'After Badge 06', location: 'Team Rocket HQ' },
  tm50: { available: 'After Badge 15', location: 'Blaine (Seafoam Islands Gym)' },
  tm51: { available: 'After Badge 01', location: 'Falkner (Violet Gym)' },
  tm52: { available: 'After Badge 02', location: 'Goldenrod Department Store' },
  tm53: { available: 'After Badge 08', location: 'Battle Frontier (64 BP)' },
  tm54: { available: 'After Badge 02', location: 'Goldenrod Department Store' },
  tm55: { available: 'After Badge 11', location: 'Celadon Department Store' },
  tm56: { available: 'After Badge 10', location: 'Rock Tunnel' },
  tm57: { available: 'After Badge 04', location: 'Olivine City' },
  tm58: { available: 'After Badge 11', location: 'Celadon Game Corner' },
  tm59: { available: 'After Badge 08', location: 'Clair (Blackthorn Gym)' },
  tm60: { available: 'After Badge 04', location: 'Route 39' },
  tm61: { available: 'After Badge 08', location: 'Battle Frontier (32 BP)' },
  tm62: { available: 'After Badge 09', location: 'Route 6' },
  tm63: { available: 'After Badge 02', location: 'Route 34' },
  tm64: { available: 'After Badge 09', location: 'Underground Path (for a RageCandyBar)' },
  tm65: { available: 'After Badge 06', location: 'Route 42' },
  tm66: { available: 'After Badge 02', location: 'Route 35' },
  tm67: { available: 'After Badge 11', location: 'Celadon City' },
  tm68: { available: 'After Badge 11', location: 'Celadon Game Corner' },
  tm69: { available: 'After Badge 10', location: 'Route 10' },
  tm70: { available: 'From the start', location: 'Sprout Tower' },
  tm71: { available: 'After Badge 08', location: 'Battle Frontier (80 BP)' },
  tm72: { available: 'After Badge 07', location: 'Ice Path' },
  tm73: { available: 'After Badge 08', location: 'Battle Frontier (32 BP)' },
  tm74: { available: 'After Badge 11', location: 'Celadon Game Corner' },
  tm75: { available: 'After Badge 02', location: 'Goldenrod Game Corner' },
  tm76: { available: 'After Badge 11', location: 'Celadon Department Store' },
  tm77: { available: 'After Badge 14', location: 'Viridian Forest' },
  tm78: { available: 'After Badge 11', location: 'Celadon Department Store' },
  tm79: { available: 'After Badge 08', location: 'Victory Road' },
  tm80: { available: 'After Badge 14', location: 'Brock (Pewter Gym)' },
  tm81: { available: 'After Badge 08', location: 'Battle Frontier (64 BP)' },
  tm82: { available: 'After Badge 02', location: 'Goldenrod Tunnel' },
  tm83: { available: 'After Badge 02', location: 'Goldenrod Department Store' },
  tm84: { available: 'After Badge 13', location: 'Janine (Fuchsia Gym)' },
  tm85: { available: 'After Badge 14', location: 'Viridian City' },
  tm86: { available: 'After Badge 09', location: 'Route 11' },
  tm87: { available: 'After Badge 04', location: 'Olivine Lighthouse' },
  tm88: { available: 'After Badge 04', location: 'Route 40' },
  tm89: { available: 'After Badge 02', location: 'Bugsy (Azalea Gym)' },
  tm90: { available: 'After Badge 02', location: 'Goldenrod Game Corner' },
  tm91: { available: 'After Badge 10', location: 'Route 9' },
  tm92: { available: 'After Badge 16', location: 'Blue (Viridian Gym)' },
  hm01: { available: 'After Badge 02', location: 'Ilex Forest' },
  hm02: { available: 'After Badge 05', location: 'Cianwood City' },
  hm03: { available: 'After Badge 03', location: 'Ecruteak Dance Theater' },
  hm04: { available: 'After Badge 04', location: 'Route 42' },
  hm05: { available: 'After Badge 06', location: 'Team Rocket HQ' },
  hm06: { available: 'After Badge 01', location: 'Route 36' },
  hm07: { available: 'After Badge 07', location: 'Ice Path' },
  hm08: { available: 'After Badge 16', location: 'Pallet Town' },
};

/** The 92 Generation IV TMs, sorted by unlock badge then location. */
export const SOULSILVER_TM_OPTIONS = [
  ['tm01', 'TM01', 'Focus Punch'],
  ['tm02', 'TM02', 'Dragon Claw'],
  ['tm03', 'TM03', 'Water Pulse'],
  ['tm04', 'TM04', 'Calm Mind'],
  ['tm05', 'TM05', 'Roar'],
  ['tm06', 'TM06', 'Toxic'],
  ['tm07', 'TM07', 'Hail'],
  ['tm08', 'TM08', 'Bulk Up'],
  ['tm09', 'TM09', 'Bullet Seed'],
  ['tm10', 'TM10', 'Hidden Power'],
  ['tm11', 'TM11', 'Sunny Day'],
  ['tm12', 'TM12', 'Taunt'],
  ['tm13', 'TM13', 'Ice Beam'],
  ['tm14', 'TM14', 'Blizzard'],
  ['tm15', 'TM15', 'Hyper Beam'],
  ['tm16', 'TM16', 'Light Screen'],
  ['tm17', 'TM17', 'Protect'],
  ['tm18', 'TM18', 'Rain Dance'],
  ['tm19', 'TM19', 'Giga Drain'],
  ['tm20', 'TM20', 'Safeguard'],
  ['tm21', 'TM21', 'Frustration'],
  ['tm22', 'TM22', 'Solar Beam'],
  ['tm23', 'TM23', 'Iron Tail'],
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
  ['tm34', 'TM34', 'Shock Wave'],
  ['tm35', 'TM35', 'Flamethrower'],
  ['tm36', 'TM36', 'Sludge Bomb'],
  ['tm37', 'TM37', 'Sandstorm'],
  ['tm38', 'TM38', 'Fire Blast'],
  ['tm39', 'TM39', 'Rock Tomb'],
  ['tm40', 'TM40', 'Aerial Ace'],
  ['tm41', 'TM41', 'Torment'],
  ['tm42', 'TM42', 'Facade'],
  ['tm43', 'TM43', 'Secret Power'],
  ['tm44', 'TM44', 'Rest'],
  ['tm45', 'TM45', 'Attract'],
  ['tm46', 'TM46', 'Thief'],
  ['tm47', 'TM47', 'Steel Wing'],
  ['tm48', 'TM48', 'Skill Swap'],
  ['tm49', 'TM49', 'Snatch'],
  ['tm50', 'TM50', 'Overheat'],
  ['tm51', 'TM51', 'Roost'],
  ['tm52', 'TM52', 'Focus Blast'],
  ['tm53', 'TM53', 'Energy Ball'],
  ['tm54', 'TM54', 'False Swipe'],
  ['tm55', 'TM55', 'Brine'],
  ['tm56', 'TM56', 'Fling'],
  ['tm57', 'TM57', 'Charge Beam'],
  ['tm58', 'TM58', 'Endure'],
  ['tm59', 'TM59', 'Dragon Pulse'],
  ['tm60', 'TM60', 'Drain Punch'],
  ['tm61', 'TM61', 'Will-O-Wisp'],
  ['tm62', 'TM62', 'Silver Wind'],
  ['tm63', 'TM63', 'Embargo'],
  ['tm64', 'TM64', 'Explosion'],
  ['tm65', 'TM65', 'Shadow Claw'],
  ['tm66', 'TM66', 'Payback'],
  ['tm67', 'TM67', 'Recycle'],
  ['tm68', 'TM68', 'Giga Impact'],
  ['tm69', 'TM69', 'Rock Polish'],
  ['tm70', 'TM70', 'Flash'],
  ['tm71', 'TM71', 'Stone Edge'],
  ['tm72', 'TM72', 'Avalanche'],
  ['tm73', 'TM73', 'Thunder Wave'],
  ['tm74', 'TM74', 'Gyro Ball'],
  ['tm75', 'TM75', 'Swords Dance'],
  ['tm76', 'TM76', 'Stealth Rock'],
  ['tm77', 'TM77', 'Psych Up'],
  ['tm78', 'TM78', 'Captivate'],
  ['tm79', 'TM79', 'Dark Pulse'],
  ['tm80', 'TM80', 'Rock Slide'],
  ['tm81', 'TM81', 'X-Scissor'],
  ['tm82', 'TM82', 'Sleep Talk'],
  ['tm83', 'TM83', 'Natural Gift'],
  ['tm84', 'TM84', 'Poison Jab'],
  ['tm85', 'TM85', 'Dream Eater'],
  ['tm86', 'TM86', 'Grass Knot'],
  ['tm87', 'TM87', 'Swagger'],
  ['tm88', 'TM88', 'Pluck'],
  ['tm89', 'TM89', 'U-turn'],
  ['tm90', 'TM90', 'Substitute'],
  ['tm91', 'TM91', 'Flash Cannon'],
  ['tm92', 'TM92', 'Trick Room'],
].map(machineOption).sort(compareMachineAvailability);

/**
 * The eight HeartGold/SoulSilver HMs (HM05 is Whirlpool, not Diamond and
 * Pearl's Defog), same shape and ordering as the TMs.
 */
export const SOULSILVER_HM_OPTIONS = [
  ['hm01', 'HM01', 'Cut'],
  ['hm02', 'HM02', 'Fly'],
  ['hm03', 'HM03', 'Surf'],
  ['hm04', 'HM04', 'Strength'],
  ['hm05', 'HM05', 'Whirlpool'],
  ['hm06', 'HM06', 'Rock Smash'],
  ['hm07', 'HM07', 'Waterfall'],
  ['hm08', 'HM08', 'Rock Climb'],
].map(machineOption).sort(compareMachineAvailability);

/**
 * Move tutors by NPC, in unlock order. The Frontier Access tutors charge
 * 32 to 64 BP per move.
 * @type {!Array<{label: string, available: string, moves: !Array<string>,
 *     options: !Array<{id: string, move: string}>}>}
 */
export const SOULSILVER_TUTOR_GROUPS = [
  {
    label: 'Ilex Forest',
    available: 'After Badge 02',
    moves: ['Headbutt'],
  },
  {
    label: 'Blackthorn City (max friendship)',
    available: 'After Badge 07',
    moves: ['Blast Burn', 'Hydro Cannon', 'Frenzy Plant', 'Draco Meteor'],
  },
  {
    label: 'Frontier Access - left tutor (BP)',
    available: 'After Badge 08',
    moves: [
      'Air Cutter', 'Bug Bite', 'Dive', 'Fire Punch', 'Fury Cutter',
      'Ice Punch', 'Icy Wind', 'Knock Off', 'Ominous Wind', 'Sucker Punch',
      'Thunder Punch', 'Trick', 'Vacuum Wave', 'Zen Headbutt',
    ],
  },
  {
    label: 'Frontier Access - right tutor (BP)',
    available: 'After Badge 08',
    moves: [
      'Ancient Power', 'Aqua Tail', 'Bounce', 'Earth Power', 'Endeavor',
      'Gastro Acid', 'Gunk Shot', 'Heat Wave', 'Iron Defense', 'Iron Head',
      'Low Kick', 'Mud-Slap', 'Outrage', 'Pain Split', 'Rollout',
      'Seed Bomb', 'Signal Beam', 'Sky Attack', 'Super Fang', 'Superpower',
      'Twister',
    ],
  },
  {
    label: 'Frontier Access - lower tutor (BP)',
    available: 'After Badge 08',
    moves: [
      'Block', 'Gravity', 'Heal Bell', 'Helping Hand', 'Last Resort',
      'Magic Coat', 'Magnet Rise', 'Role Play', 'Snore', 'Spite',
      'String Shot', 'Swift', 'Synthesis', 'Tailwind', 'Uproar',
      'Worry Seed',
    ],
  },
].map((group) => ({
  ...group,
  options: group.moves.map((move) => ({ id: toMoveId(move), move })),
}));

/** Every tutor move once. @type {!Array<{id: string, move: string}>} */
export const SOULSILVER_TUTOR_OPTIONS = SOULSILVER_TUTOR_GROUPS.flatMap(
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
