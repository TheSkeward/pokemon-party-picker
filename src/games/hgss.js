/**
 * The Pokémon HeartGold and SoulSilver game descriptor (see reborn.js for
 * what each field means). One game for both versions: nothing the engine
 * models differs between them. A mainline game: no game-original items,
 * real trades, and the Generation IV learnsets as the legality basis. Its
 * data paths and saved-state keys are namespaced by game id. Item content
 * is curated by hand in hgss/items.js.
 */
import { EVOLUTION_STONE_FIELDS } from '../reborn/evolution-access.js';
import { HGSS_PROGRESSION_CHECKPOINTS } from '../hgss/schedule.js';
import {
  HGSS_EVOLUTION_ITEM_AVAILABILITY,
  HGSS_EXTRA_INVENTORY_ITEMS,
  HGSS_ITEM_UNLOCK_BADGES,
  HGSS_SHOP_ITEM_BADGES,
} from '../hgss/items.js';
import {
  HGSS_HM_OPTIONS,
  HGSS_TM_OPTIONS,
  HGSS_TUTOR_GROUPS,
  HGSS_TUTOR_OPTIONS,
} from '../hgss/move-sources.js';

// Generation IV has no Ice Stone; the other nine stones exist.
const STONE_FIELDS = EVOLUTION_STONE_FIELDS.filter(
  (field) => field.item !== 'Ice Stone',
);

/**
 * The access gates HGSS's progression exposes, in display order. The
 * location evolutions (magnetic field, Moss Rock, Ice Rock) have no gate
 * because the game has no such place; see `unavailableAccessKeys`.
 * @type {!Array<{key: string, label: string, item: (string|undefined)}>}
 */
const HGSS_ACCESS_FIELDS = Object.freeze([
  { key: 'evoAccessFriendship', label: 'Friendship evolutions' },
  ...STONE_FIELDS,
  { key: 'evoAccessOtherEvoItems', label: 'Other evolution items (Metal Coat, Razor Claw, …)' },
  { key: 'evoAccessTrading', label: 'Trading (trade evolutions need a second game)' },
  { key: 'evoAccessPartyCondition', label: 'Party-condition evolutions (Mantyke needs a Remoraid)' },
]);

export const HGSS_GAME = Object.freeze({
  id: 'hgss',
  label: 'Pokémon HeartGold and SoulSilver',
  shortLabel: 'HGSS',
  dexGen: 4,
  // Loaded on demand: the Gen 4 bundle is its own chunk.
  loadDex: () => import('./dex-gen4.js').then((module) => module.GEN4_DEX),
  families: Object.freeze(['gen4singles']),
  schedule: Object.freeze({
    checkpoints: HGSS_PROGRESSION_CHECKPOINTS,
    itemUnlockBadges: HGSS_ITEM_UNLOCK_BADGES,
  }),
  moveSources: Object.freeze({
    tmOptions: HGSS_TM_OPTIONS,
    tmxOptions: HGSS_HM_OPTIONS,
    tmxLabel: 'HM',
    tutorGroups: HGSS_TUTOR_GROUPS,
    tutorOptions: HGSS_TUTOR_OPTIONS,
  }),
  // No Common Candy and no Type Changer: a level never goes down, and Hidden
  // Power's type follows IVs.
  mechanics: Object.freeze({
    levelDown: false,
    hiddenPowerTypeChanger: false,
  }),
  // No mining, no replaced items, no game-original held items; the shops are
  // the Athlete Shop, the Game Corners, and the Frontier's BP counter.
  items: Object.freeze({
    shopItemBadges: HGSS_SHOP_ITEM_BADGES,
    miningItemBadges: Object.freeze({}),
    extraInventoryItems: HGSS_EXTRA_INVENTORY_ITEMS,
    hiddenInventoryItemIds: new Set(),
    inventoryMigration: Object.freeze({}),
    evolutionItemAvailability: HGSS_EVOLUTION_ITEM_AVAILABILITY,
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
    accessFields: HGSS_ACCESS_FIELDS,
  }),
  rules: Object.freeze({
    legalityBase: Object.freeze({
      generation: 4,
      baseGames: 'HGSS',
      transferMovesAvailableByDefault: false,
    }),
    tmxMoves: [...HGSS_HM_OPTIONS]
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((option) => option.move),
    promotedTmMoves: Object.freeze([]),
    notes: Object.freeze([
      'Move legality follows the Generation IV learnsets, counting only the machines and tutors HeartGold and SoulSilver have.',
      'Level caps are the obedience thresholds. In HGSS they bind only traded Pokémon, so they mark the pace of a playthrough rather than a hard limit.',
      'Cut, Fly, Surf, Strength, Whirlpool, Rock Smash, Waterfall, and Rock Climb are HMs.',
      'Defog was an HM in Diamond, Pearl, and Platinum only; no machine teaches it here.',
      'Event-only moves and Pokéwalker pickups are not counted.',
      "Hidden Power's type follows IVs and cannot be changed, so it is never counted as a plannable move.",
      "A set's ability is assumed obtainable at catch (there is no Ability Capsule); declare a caught ability in the pool, as in Cyndaquil (Blaze), to pin it.",
    ]),
  }),
  data: Object.freeze({
    legalMovesDir: 'hgss-legal-moves',
  }),
  // The game launched under the id "soulsilver"; saves made under those keys
  // move to the new ones on first read (games/saved-state.js).
  storage: Object.freeze({
    progression: 'pokemon-party-picker:hgss:progression:v1',
    pool: 'pokemon-party-picker:hgss:owned-pool:v1',
    legacy: Object.freeze({
      progression: 'pokemon-party-picker:soulsilver:progression:v1',
      pool: 'pokemon-party-picker:soulsilver:owned-pool:v1',
    }),
  }),
});
