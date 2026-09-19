/**
 * The Pokémon SoulSilver game descriptor (see reborn.js for what each field
 * means). A mainline game: no game-original items, real trades, and the
 * Generation IV learnsets as the legality basis. Its data paths and saved-
 * state keys are namespaced by game id.
 *
 * Deliberately empty for now, to be curated: renewable item sources by
 * badge, evolution-item availability (every item evolution surfaces as
 * "availability unknown" until then), and the badge at which each held item
 * first arrives.
 */
import { GEN4_DEX } from './dex-gen4.js';
import { EVOLUTION_STONE_FIELDS } from '../reborn/evolution-access.js';
import { SOULSILVER_PROGRESSION_CHECKPOINTS } from '../soulsilver/schedule.js';
import {
  SOULSILVER_HM_OPTIONS,
  SOULSILVER_TM_OPTIONS,
  SOULSILVER_TUTOR_GROUPS,
  SOULSILVER_TUTOR_OPTIONS,
} from '../soulsilver/move-sources.js';

// Generation IV has no Ice Stone; the other nine stones exist.
const STONE_FIELDS = EVOLUTION_STONE_FIELDS.filter(
  (field) => field.item !== 'Ice Stone',
);

/**
 * The access gates SoulSilver's progression exposes, in display order. The
 * location evolutions (magnetic field, Moss Rock, Ice Rock) have no gate
 * because the game has no such place; see `unavailableAccessKeys`.
 * @type {!Array<{key: string, label: string, item: (string|undefined)}>}
 */
const SOULSILVER_ACCESS_FIELDS = Object.freeze([
  { key: 'evoAccessFriendship', label: 'Friendship evolutions' },
  ...STONE_FIELDS,
  { key: 'evoAccessOtherEvoItems', label: 'Other evolution items (Metal Coat, Razor Claw, …)' },
  { key: 'evoAccessTrading', label: 'Trading (trade evolutions need a second game)' },
  { key: 'evoAccessPartyCondition', label: 'Party-condition evolutions (Mantyke needs a Remoraid)' },
]);

export const SOULSILVER_GAME = Object.freeze({
  id: 'soulsilver',
  label: 'Pokémon SoulSilver',
  shortLabel: 'SoulSilver',
  dexGen: 4,
  dex: GEN4_DEX,
  families: Object.freeze(['gen4singles']),
  schedule: Object.freeze({
    checkpoints: SOULSILVER_PROGRESSION_CHECKPOINTS,
    itemUnlockBadges: Object.freeze({}),
  }),
  moveSources: Object.freeze({
    tmOptions: SOULSILVER_TM_OPTIONS,
    tmxOptions: SOULSILVER_HM_OPTIONS,
    tutorGroups: SOULSILVER_TUTOR_GROUPS,
    tutorOptions: SOULSILVER_TUTOR_OPTIONS,
  }),
  items: Object.freeze({
    shopItemBadges: Object.freeze({}),
    miningItemBadges: Object.freeze({}),
    extraInventoryItems: Object.freeze([]),
    hiddenInventoryItemIds: new Set(),
    inventoryMigration: Object.freeze({}),
    evolutionItemAvailability: Object.freeze({}),
    fieldSeeds: Object.freeze({
      names: Object.freeze([]),
      proxyItems: Object.freeze([]),
      statVectors: Object.freeze({}),
    }),
    typeGems: Object.freeze([]),
  }),
  // Trades are real trades; Feebas's Beauty evolution and the three location
  // evolutions cannot be performed in this game (no Poffins, no magnetic
  // field, no Moss Rock or Ice Rock in Johto or Kanto).
  evolution: Object.freeze({
    tradeItem: null,
    tradeAccessKey: 'evoAccessTrading',
    regionAccess: Object.freeze({}),
    unavailableAccessKeys: new Set([
      'evoAccessMagneticField',
      'evoAccessMossyRock',
      'evoAccessIcyRock',
      'evoAccessOtherLocations',
    ]),
    formNotes: Object.freeze({}),
    accessFields: SOULSILVER_ACCESS_FIELDS,
  }),
  rules: Object.freeze({
    legalityBase: Object.freeze({
      generation: 4,
      baseGames: 'HGSS',
      transferMovesAvailableByDefault: false,
    }),
    tmxMoves: SOULSILVER_HM_OPTIONS.map((option) => option.move),
    promotedTmMoves: Object.freeze([]),
    notes: Object.freeze([
      'Move legality follows the Generation IV learnsets, counting only the machines and tutors HeartGold and SoulSilver have.',
      'Level caps are the obedience thresholds. In SoulSilver they bind only traded Pokémon, so they mark the pace of a playthrough rather than a hard limit.',
      'Cut, Fly, Surf, Strength, Whirlpool, Rock Smash, Waterfall, and Rock Climb are HMs.',
      'Defog was an HM in Diamond, Pearl, and Platinum only; no machine teaches it here.',
      'Event-only moves and Pokéwalker pickups are not counted.',
    ]),
  }),
  data: Object.freeze({
    legalMovesDir: 'soulsilver-legal-moves',
  }),
  storage: Object.freeze({
    progression: 'pokemon-party-picker:soulsilver:progression:v1',
    pool: 'pokemon-party-picker:soulsilver:owned-pool:v1',
  }),
});
