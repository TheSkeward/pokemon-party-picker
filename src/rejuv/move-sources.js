/**
 * @fileoverview Rejuvenation's machines and tutors with pickup timing, in
 * the shape games/legality.js serves (see reborn/progression-options.js).
 * The machine list itself is generated from the game's items.dat
 * (generated/rejuvMoveSources.generated.js); this module adds the timing.
 *
 * Timing is curated from BIGJRA's walkthrough (bigjra.github.io/rejuvenation,
 * V13.5): a machine is timed by the badge count held when the chapter that
 * first reaches it begins, plus the badge that chapter awards when the
 * pickup follows the gym. A shop-sold machine carries the shop and, where
 * the game's marts.dat gates the sale on a badge count, that count. A
 * machine the walkthrough never names carries no timing. Tutors are the
 * game's TUTORMOVES table (Scripts/Rejuv/SystemConstants.rb, V14.0), grouped
 * by the location the table groups them under and timed by the chapter the
 * walkthrough first reaches each tutor; the table's "unplaced" moves have
 * no tutor in the world and are left out.
 */
import { REJUV_MACHINES } from '../generated/rejuvMoveSources.generated.js';

// Machine id -> the badge held when it is first obtainable, and where.
const MACHINE_TIMING = {
  hm01: { badge: 2, location: 'Chrysalis Manor (chapter 3)' },
  hm02: { badge: 12, location: 'Route 9, from Damien (chapter 13)' },
  hm03: { badge: 5, location: 'Ranger HQ (chapter 6)' },
  hm04: { badge: 10, location: 'Darchlight Village (chapter 10)' },
  hm05: { badge: 14, location: 'Somniam Mall (chapter 15)' },
  hm06: { badge: 10, location: 'GDC Arcade prize (chapter 11)' },
  rm01: { badge: 12, location: 'Kristiline TM Shop (12 badges)' },
  rm02: { badge: 7, location: 'Kristiline TM Shop' },
  rm03: { badge: 7, location: 'Kristiline TM Shop' },
  rm04: { badge: 7, location: 'Kristiline TM Shop' },
  rm05: { badge: 12, location: 'Kristiline TM Shop (12 badges)' },
  rm06: { badge: 7, location: 'Kristiline TM Shop' },
  rm07: { badge: 7, location: 'Kristiline TM Shop' },
  rm08: { badge: 7, location: 'Kristiline TM Shop' },
  rm09: { badge: 7, location: 'Kristiline TM Shop' },
  tm01: { badge: 6, location: 'Chapter 7' },
  tm02: { badge: 6, location: 'Chapter 7' },
  tm05: { badge: 6, location: 'Chapter 7' },
  tm07: { badge: 7, location: 'Chapter 8' },
  tm09: { badge: 1, location: 'Chapter 2' },
  tm10: { badge: 0, location: 'Gearen Game Corner (5,000 Coins)' },
  tm11: { badge: 12, location: 'Chapter 13' },
  tm12: { badge: 10, location: 'Chapter 10' },
  tm13: { badge: 12, location: 'Chapter 13' },
  tm17: { badge: 5, location: 'Chapter 6' },
  tm18: { badge: 9, location: 'Chapter 10' },
  tm19: { badge: 1, location: 'Chapter 2' },
  tm20: { badge: 6, location: 'Chapter 7' },
  tm21: { badge: 8, location: 'Chapter 9' },
  tm22: { badge: 12, location: 'Chapter 13' },
  tm23: { badge: 9, location: 'Chapter 10' },
  tm24: { badge: 15, location: "Shayda's Umbral Shards (New Game+)" },
  tm26: { badge: 15, location: "Shayda's Umbral Shards (New Game+)" },
  tm27: { badge: 12, location: 'Chapter 13' },
  tm28: { badge: 6, location: 'Chapter 7' },
  tm29: { badge: 10, location: 'Chapter 11' },
  tm30: { badge: 4, location: 'Narcissa (chapter 4)' },
  tm31: { badge: 10, location: 'Chapter 11' },
  tm32: { badge: 6, location: 'Chapter 7' },
  tm34: { badge: 14, location: 'Somniam Mall (chapter 15)' },
  tm35: { badge: 11, location: 'Chapter 12' },
  tm36: { badge: 7, location: 'Chapter 8' },
  tm40: { badge: 8, location: 'Chapter 9' },
  tm41: { badge: 5, location: 'Chapter 6' },
  tm42: { badge: 3, location: 'Chapter 3' },
  tm43: { badge: 1, location: 'Chapter 2' },
  tm45: { badge: 4, location: 'Chapter 5' },
  tm46: { badge: 5, location: 'Chapter 6' },
  tm47: { badge: 5, location: 'AP Shop (5 AP, 5 badges)' },
  tm48: { badge: 3, location: 'Chapter 4' },
  tm49: { badge: 1, location: 'Help Center, 5 Zygarde Cells (chapter 2)' },
  tm50: { badge: 8, location: 'Amber (chapter 8)' },
  tm51: { badge: 7, location: 'Chapter 8' },
  tm53: { badge: 10, location: 'Flora or Florin (chapter 10)' },
  tm54: { badge: 2, location: 'Chapter 3' },
  tm55: { badge: 14, location: 'Somniam Mall (chapter 15)' },
  tm56: { badge: 5, location: 'AP Shop (5 AP, 5 badges)' },
  tm58: { badge: 5, location: 'Chapter 6' },
  tm60: { badge: 1, location: 'Chapter 1' },
  tm61: { badge: 12, location: 'Chapter 13' },
  tm62: { badge: 12, location: 'Souta (chapter 12)' },
  tm63: { badge: 1, location: 'Chapter 2' },
  tm64: { badge: 8, location: 'Chapter 9' },
  tm65: { badge: 6, location: 'Chapter 7' },
  tm67: { badge: 10, location: 'Chapter 11' },
  tm68: { badge: 12, location: 'Chapter 13' },
  tm69: { badge: 6, location: 'Chapter 7' },
  tm70: { badge: 0, location: 'Gearen Game Corner (1,000 Coins)' },
  tm72: { badge: 9, location: 'Erick (chapter 9)' },
  tm73: { badge: 7, location: 'Chapter 8' },
  tm76: { badge: 5, location: 'Chapter 6' },
  tm78: { badge: 3, location: 'Chapter 4' },
  tm80: { badge: 13, location: 'Adam (chapter 13)' },
  tm81: { badge: 6, location: 'Crawli (chapter 6)' },
  tm82: { badge: 15, location: 'Chapter 15' },
  tm83: { badge: 0, location: 'Chapter 1' },
  tm84: { badge: 8, location: 'Chapter 9' },
  tm85: { badge: 10, location: 'Chapter 11' },
  tm86: { badge: 7, location: 'Chapter 8' },
  tm87: { badge: 5, location: 'Chapter 6' },
  tm89: { badge: 15, location: 'Chapter 15' },
  tm90: { badge: 14, location: 'Somniam Mall (chapter 15)' },
  tm92: { badge: 8, location: 'Chapter 9' },
  tm93: { badge: 13, location: 'Chapter 14' },
  tm94: { badge: 1, location: 'Chapter 2' },
  tm95: { badge: 9, location: 'Chapter 10' },
  tm96: { badge: 4, location: 'Chapter 5' },
  tm97: { badge: 9, location: 'Chapter 10' },
  tm98: { badge: 5, location: 'Chapter 6' },
  tm100: { badge: 4, location: 'Chapter 5' },
  tm101: { badge: 6, location: 'Chapter 7' },
  tm102: { badge: 1, location: 'Venam (chapter 1)' },
  tm104: { badge: 6, location: 'Chapter 7' },
  tm105: { badge: 14, location: 'Ryland (chapter 14)' },
  tm106: { badge: 5, location: 'Chapter 6' },
  tm107: { badge: 9, location: 'Chapter 10' },
  tm108: { badge: 5, location: 'Chapter 6' },
  tm110: { badge: 7, location: 'Chapter 8' },
  tm111: { badge: 6, location: 'Chapter 7' },
  tm113: { badge: 5, location: 'Chapter 6' },
  tm114: { badge: 10, location: 'Chapter 10' },
  tm115: { badge: 9, location: 'Chapter 10' },
  tm116: { badge: 12, location: 'Kristiline TM Shop (12 badges)' },
  tm117: { badge: 3, location: 'Chapter 4' },
  tm119: { badge: 0, location: 'Help Center quest (chapter 1)' },
  tm120: { badge: 11, location: 'Chapter 12' },
  tm121: { badge: 1, location: 'Chapter 2' },
  tm122: { badge: 3, location: 'Chapter 4' },
  tm124: { badge: 7, location: 'Chapter 8' },
  tm125: { badge: 12, location: 'Kristiline TM Shop (12 badges)' },
  tm126: { badge: 0, location: 'Chapter 1' },
  tm128: { badge: 12, location: 'Chapter 13' },
  tm132: { badge: 7, location: 'Chapter 8' },
  tm133: { badge: 6, location: 'Chapter 7' },
  tm134: { badge: 7, location: 'Chapter 8' },
  tm136: { badge: 4, location: 'Chapter 5' },
  tm137: { badge: 7, location: 'Chapter 8' },
  tm138: { badge: 7, location: 'Chapter 8' },
  tm139: { badge: 7, location: 'Chapter 8' },
  tm140: { badge: 3, location: 'Wispy Park shop' },
  tm141: { badge: 3, location: 'Wispy Park shop' },
  tm142: { badge: 3, location: 'Wispy Park shop' },
  tm143: { badge: 7, location: 'Kristiline TM Shop' },
  tm144: { badge: 5, location: 'Chapter 6' },
  tm145: { badge: 5, location: 'Chapter 6' },
  tm146: { badge: 5, location: 'Chapter 6' },
  tm149: { badge: 9, location: 'Chapter 10' },
  tm150: { badge: 10, location: 'GDC Arcade (2,000 Coins, 10 badges)' },
  tm151: { badge: 10, location: 'GDC Arcade (2,000 Coins, 10 badges)' },
  tm152: { badge: 10, location: 'GDC Arcade (2,000 Coins, 10 badges)' },
  tm153: { badge: 10, location: 'GDC Arcade (2,000 Coins, 10 badges)' },
  tm155: { badge: 12, location: 'Kristiline TM Shop (12 badges)' },
  tm156: { badge: 9, location: 'Chapter 10' },
  tm157: { badge: 7, location: 'Kristiline TM Shop' },
  tm159: { badge: 9, location: 'Chapter 10' },
};

const availabilityLabel = (badge) =>
  badge === 0 ? 'Before Badge 01' : `After Badge ${String(badge).padStart(2, '0')}`;

function withTiming(machine) {
  const timing = MACHINE_TIMING[machine.id];
  const option = { id: machine.id, code: machine.code, move: machine.move };
  if (!timing) return option;
  return {
    ...option,
    available: availabilityLabel(timing.badge),
    location: timing.location,
  };
}

function compareMachineAvailability(a, b) {
  return (
    getBadgeOrder(a.available) - getBadgeOrder(b.available) ||
    String(a.location || '').localeCompare(String(b.location || '')) ||
    a.code.localeCompare(b.code, undefined, { numeric: true })
  );
}

function getBadgeOrder(available) {
  const match = String(available || '').match(/Badge\s+(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : 999;
}

/**
 * The TMs and the Kristiline RMs, with pickup timing, sorted by unlock
 * badge then location.
 * @type {!Array<{id: string, code: string, move: string,
 *     available: (string|undefined), location: (string|undefined)}>}
 */
export const REJUV_TM_OPTIONS = REJUV_MACHINES
  .filter((machine) => machine.kind !== 'hm')
  .map(withTiming)
  .sort(compareMachineAvailability);

/**
 * The six HMs, same shape and ordering.
 * @type {!Array<{id: string, code: string, move: string,
 *     available: (string|undefined), location: (string|undefined)}>}
 */
export const REJUV_HM_OPTIONS = REJUV_MACHINES
  .filter((machine) => machine.kind === 'hm')
  .map(withTiming)
  .sort(compareMachineAvailability);

/**
 * Move tutors grouped by tutor, in unlock order; `options` carries the
 * group's moves as {id, move} pairs. Luck's Tent's seven tutors open one by
 * one (Marshie from the start, then at 3, 5, 7, 9, 11, and 15 badges).
 * @type {!Array<{label: string, available: string, moves: !Array<string>,
 *     options: !Array<{id: string, move: string}>}>}
 */
export const REJUV_TUTOR_GROUPS = [
  {
    label: "Luck's Tent - Marshie",
    available: 'Before Badge 01',
    moves: ['Bind', 'Covet', 'Block', 'Spite', 'Swift', 'After You', 'Gravity', 'Magic Coat'],
  },
  {
    label: "Luck's Tent - Margo",
    available: 'After Badge 03',
    moves: ['Venom Drench', 'Imprison', 'Recycle', 'Worry Seed', 'Snore', 'Shock Wave', 'Water Pulse', 'Snatch', 'Wonder Room', 'Magic Room'],
  },
  {
    label: 'Wispy Park',
    available: 'After Badge 03',
    moves: ['Psybeam', 'Confuse Ray', 'Poison Tail', 'Metal Claw', 'Metal Sound', 'Air Cutter', 'Disarming Voice', 'Headbutt', 'Fire Pledge', 'Water Pledge', 'Grass Pledge'],
  },
  {
    label: 'Kakori Beach',
    available: 'After Badge 04',
    moves: ['Dragon Cheer', 'Trailblaze', 'Feather Dance', 'Lunge', 'Haze', 'Chilling Water', 'Pluck', 'Night Shade', 'Take Down', 'String Shot', 'Pounce', 'Tearful Look'],
  },
  {
    label: "Luck's Tent - Marvin",
    available: 'After Badge 05',
    moves: ['Blaze Kick', 'Super Fang', 'Trick', 'Dual Chop', 'Helping Hand', 'Giga Drain', 'Synthesis', 'Magnet Rise', 'Uproar'],
  },
  {
    label: "Luck's Tent - Marnie",
    available: 'After Badge 07',
    moves: ['Role Play', 'Bug Bite', 'Bounce', 'Drill Run', 'Electroweb', 'Gastro Acid', 'Focus Energy', 'Skill Swap', 'Signal Beam'],
  },
  {
    label: 'Akuwa Town Battle Club',
    available: 'After Badge 07',
    moves: ['Fire Punch', 'Ice Punch', 'Thunder Punch', 'Heal Bell', 'Skitter Smack', 'Hard Press', 'Charge', 'Revenge', 'Stomping Tantrum', 'Iron Tail', 'Endeavor', 'Iron Defense', 'Lash Out', 'Petal Blizzard', 'Corrosive Gas'],
  },
  {
    label: "Luck's Tent - Marlow",
    available: 'After Badge 09',
    moves: ['Coaching', 'Aqua Tail', 'Laser Focus', 'Spikes', 'Reversal', 'Endure', 'Amnesia', 'Electro Ball', 'Ally Switch'],
  },
  {
    label: 'Oblitus Town',
    available: 'After Badge 09',
    moves: ['Hydro Cannon', 'Blast Burn', 'Frenzy Plant'],
  },
  {
    label: 'Festival Plaza',
    available: 'After Badge 10',
    moves: ['Fire Pledge', 'Water Pledge', 'Grass Pledge', 'Earth Power', 'Focus Punch', 'Drain Punch', 'Pain Split', 'Misty Explosion', 'Supercell Slam', 'Psychic Noise', 'Superpower', 'Heat Wave', 'Stealth Rock', 'Toxic Spikes', 'Future Sight', 'Flip Turn', 'Alluring Voice'],
  },
  {
    label: "Luck's Tent - Marley",
    available: 'After Badge 11',
    moves: ['Hyper Voice', 'Sky Attack', 'Icy Wind', 'Tailwind', 'Baton Pass', 'Encore', 'High Horsepower', 'Agility', 'Crunch'],
  },
  {
    label: 'Neo East Gearen City',
    available: 'After Badge 12',
    moves: ['Iron Head', 'Foul Play', 'Knock Off', 'Poltergeist', 'Bug Buzz', 'Last Resort', 'Outrage', 'Low Kick', 'Steel Roller', 'Power Gem', 'Throat Chop'],
  },
  {
    label: 'Kingdom of Goomidra - Goomatora',
    available: 'After Badge 13',
    moves: ['Body Slam', 'Seed Bomb', 'Dragon Pulse', 'Megahorn', 'Scorching Sands', 'Zen Headbutt', 'Liquidation', 'Muddy Water', 'Defog', 'Dual Wingbeat', 'Temper Flare', 'Ice Spinner', 'Body Press', 'Stored Power', 'Burning Jealousy', 'Psychic Fangs'],
  },
  {
    label: 'Kingdom of Goomidra - Goombina',
    available: 'After Badge 14',
    moves: ['Draco Meteor'],
  },
  {
    label: "Luck's Tent - Macbeth",
    available: 'After Badge 15',
    moves: ['Telekinesis', 'Cosmic Power', 'Leaf Blade', 'Aura Sphere', 'Heavy Slam', 'Heat Crash', 'Gunk Shot', 'Pollen Puff', 'Terrain Pulse', 'Rage Fist'],
  },
].map((group) => ({
  ...group,
  options: group.moves.map((move) => ({ id: normalizeMoveId(move), move })),
}));

/**
 * Every tutor move once, first-group-first (the Pledges have several
 * tutors).
 * @type {!Array<{id: string, move: string}>}
 */
export const REJUV_TUTOR_OPTIONS = uniqueOptions(
  REJUV_TUTOR_GROUPS.flatMap((group) => group.options),
);

function normalizeMoveId(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function uniqueOptions(options) {
  const seen = new Set();
  return options.filter((option) => {
    if (seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
}
