/**
 * The Pokémon Rejuvenation game descriptor (see reborn.js for what each
 * field means). Rejuvenation runs Reborn's engine family, so it shares
 * Reborn's mechanics (Reverse Candy level-downs, reusable TMs, field seeds
 * and type gems in place of terrain seeds, a Link item for trades) on a Gen
 * 9 dex with the National Dex usage families as its prior. Its curated
 * data lives in rejuv/ and its legal moves come from its own mons.dat
 * (scripts/build-rejuv-legal-moves.mjs) through the committed Gen 9 map.
 *
 * What the Gen 9 identity cannot carry stays out of the planner: the Aevian
 * and Rift forms, the game's own species and moves, and the Crests. They
 * exist in the game data (scripts/rejuv/) but the usage prior and the move
 * tables are the generation's, so nothing can score them.
 */
import { EVOLUTION_STONE_FIELDS } from '../reborn/evolution-access.js';
import {
  GEN7_TERRAIN_SEEDS,
  HIDDEN_INVENTORY_ITEM_IDS,
  REBORN_SEEDS,
  REBORN_SEED_STAT_VECTORS,
  TERRAIN_SEED_MIGRATION,
} from '../reborn/reborn-seeds.js';
import { TYPE_GEMS } from '../reborn/type-gems.js';
import { REJUV_PROGRESSION_CHECKPOINTS } from '../rejuv/badge-timeline.js';
import {
  REJUV_EVOLUTION_ITEM_AVAILABILITY,
  REJUV_EXTRA_INVENTORY_ITEMS,
  REJUV_ITEM_UNLOCK_BADGES,
  REJUV_SHOP_ITEM_BADGES,
} from '../rejuv/items.js';
import {
  REJUV_HM_OPTIONS,
  REJUV_TM_OPTIONS,
  REJUV_TUTOR_GROUPS,
  REJUV_TUTOR_OPTIONS,
} from '../rejuv/move-sources.js';

/**
 * The access gates Rejuvenation's progression exposes, in display order.
 * The regional-form gates name the game's own evolution maps
 * (Scripts/Rejuv/SystemConstants.rb, EvoLocations).
 * @type {!Array<{key: string, label: string, item: (string|undefined)}>}
 */
const REJUV_ACCESS_FIELDS = Object.freeze([
  { key: 'evoAccessFriendship', label: 'Friendship / affection evolutions' },
  ...EVOLUTION_STONE_FIELDS,
  { key: 'evoAccessOtherEvoItems', label: 'Other evolution items (Metal Coat, Razor Claw, …)' },
  { key: 'evoAccessLinkHeart', label: 'Link Heart (trade evolutions)' },
  { key: 'evoAccessPartyCondition', label: 'Party-condition evolutions (Mantyke needs a Remoraid)' },
  { key: 'evoAccessMagneticField', label: 'Magnetic field area (Terajuma Excavation Site, West Gearen Power Plant)' },
  { key: 'evoAccessMossyRock', label: 'Moss Rock (Great Terajuma Falls)' },
  { key: 'evoAccessIcyRock', label: 'Ice Rock (Evergreen Cave)' },
  { key: 'evoAccessColdSpots', label: 'Cold climates (Route 11, Evergreen Island: Crabominable, Mr. Rime, Hisuian Braviary)' },
  { key: 'evoAccessOtherLocations', label: 'Wispy Ruins (Runerigus)' },
  { key: 'evoAccessGoldenwood', label: 'Goldenwood Forest region (Alolan Marowak)' },
  { key: 'evoAccessTerajuma', label: 'Terajuma Island (Alolan Exeggutor)' },
  { key: 'evoAccessWestGearen', label: 'West Gearen City (Galarian Weezing)' },
  { key: 'evoAccessHisuianSpots', label: 'Hisuian spots (Sheridan and Route 9 for Lilligant, Goomidra for Sliggoo, Mt. Terajuma for Avalugg)' },
]);

export const REJUV_GAME = Object.freeze({
  id: 'rejuv',
  label: 'Pokémon Rejuvenation',
  shortLabel: 'Rejuvenation',
  dexGen: 9,
  // Loaded on demand: the Gen 9 bundle is its own chunk.
  loadDex: () => import('./dex-gen9.js').then((module) => module.GEN9_DEX),
  families: Object.freeze(['gen9natdexsingles', 'gen9natdexdoubles']),
  schedule: Object.freeze({
    checkpoints: REJUV_PROGRESSION_CHECKPOINTS,
    itemUnlockBadges: REJUV_ITEM_UNLOCK_BADGES,
  }),
  moveSources: Object.freeze({
    tmOptions: REJUV_TM_OPTIONS,
    tmxOptions: REJUV_HM_OPTIONS,
    tmxLabel: 'HM',
    tutorGroups: REJUV_TUTOR_GROUPS,
    tutorOptions: REJUV_TUTOR_OPTIONS,
  }),
  // Reverse Candy lowers a level, as Reborn's Common Candy does. Whether
  // the game has a Hidden Power type changer is not established, so Hidden
  // Power's type follows IVs and it is never a plannable move. TMs are
  // reusable.
  mechanics: Object.freeze({
    levelDown: true,
    hiddenPowerTypeChanger: false,
    reusableTms: true,
  }),
  // Rejuvenation has Reborn's field seeds (Elemental, Telluric, Synthetic,
  // Magical) and the full set of type gems, priced with the same proxies;
  // its Rift Seed has no counterpart and is not modeled. No mining.
  items: Object.freeze({
    shopItemBadges: REJUV_SHOP_ITEM_BADGES,
    miningItemBadges: Object.freeze({}),
    extraInventoryItems: REJUV_EXTRA_INVENTORY_ITEMS,
    hiddenInventoryItemIds: HIDDEN_INVENTORY_ITEM_IDS,
    inventoryMigration: TERRAIN_SEED_MIGRATION,
    evolutionItemAvailability: REJUV_EVOLUTION_ITEM_AVAILABILITY,
    fieldSeeds: Object.freeze({
      names: REBORN_SEEDS,
      proxyItems: GEN7_TERRAIN_SEEDS,
      statVectors: REBORN_SEED_STAT_VECTORS,
    }),
    typeGems: TYPE_GEMS,
  }),
  // The Link Heart replaces trades. Regional evolutions happen on the maps
  // the game names for them: Alolan Marowak anywhere in the Goldenwood
  // Forest region, Alolan Exeggutor on Terajuma Island, Galarian Weezing in
  // West Gearen City, the Hisuian ones at their own spots. Every location
  // evolution exists.
  evolution: Object.freeze({
    tradeItem: 'Link Heart',
    tradeAccessKey: 'evoAccessLinkHeart',
    regionAccess: Object.freeze({
      Alola: Object.freeze({
        accessKey: 'evoAccessTerajuma',
        label: 'on Terajuma Island',
        except: ['marowakalola', 'raichualola'],
      }),
      Galar: Object.freeze({
        accessKey: 'evoAccessWestGearen',
        label: 'in West Gearen City',
      }),
      Hisui: Object.freeze({
        accessKey: 'evoAccessHisuianSpots',
        label: 'at its Hisuian spot',
      }),
    }),
    unavailableAccessKeys: new Set(),
    formNotes: Object.freeze({
      marowak: 'in the Goldenwood Forest region, Darchlight Woods, or Oblitus Town',
    }),
    accessFields: REJUV_ACCESS_FIELDS,
  }),
  rules: Object.freeze({
    legalityBase: Object.freeze({
      generation: 9,
      baseGames: 'Rejuvenation V14',
      transferMovesAvailableByDefault: false,
    }),
    tmxMoves: [...REJUV_HM_OPTIONS]
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((option) => option.move),
    promotedTmMoves: Object.freeze([]),
    notes: Object.freeze([
      "Move legality comes from Rejuvenation's own data (mons.dat, V14.0): its level-up lists, egg moves, and machine and tutor compatibility, resolved onto the Gen 9 dex.",
      'Level caps are the game\'s hard caps: 18 before the first badge, then 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 85, 90, 90, 100, 100 by badge count.',
      'Cut, Fly, Surf, Strength, Waterfall, and Dive are HMs; TMs are reusable.',
      "Machine and tutor timing follows BIGJRA's walkthrough by the chapter each is first reached; the game's own shop conditions gate the shop-sold ones.",
      "Rejuvenation's own moves (Poison Sweep, Stacking Shot, Deluge, Arenite Wall, Irritation, Slash and Burn, Mud Barrage, Magma Drift) and its Aevian, Rift, and original species are outside the Gen 9 tables and are not planned for.",
      "Hidden Power's type follows IVs and is not counted as a plannable move.",
      'Crests are not modeled: the recommender has no prior to price them with.',
    ]),
  }),
  // Palette (styles/main.css, app/theme.js), sampled from the game's own
  // UI: the summary screen's navy and slate panels, the Bag's blue frames,
  // the battle box's cyan HP bar, and the summary tabs' gold and rose,
  // lightened only as far as WCAG AA demands for small text on the shell.
  theme: Object.freeze({
    scheme: 'dark',
    shell: Object.freeze({
      base: '#141c2e',
      surface: '#243250',
      hairline: '#3a4a70',
      text: '#f2f4f8',
      textMuted: '#adb9d0',
      ink: '#0f1522',
    }),
    states: Object.freeze({
      ok: '#62c46e',
      warn: '#e0b448',
      blocked: '#f58279',
    }),
    accents: Object.freeze([
      { name: 'cyan', color: '#52b4f0' },
      { name: 'blue', color: '#86aaec' },
      { name: 'gold', color: '#d9b23c' },
      { name: 'rose', color: '#e58cc4' },
    ]),
  }),
  data: Object.freeze({
    legalMovesDir: 'rejuv-legal-moves',
  }),
  storage: Object.freeze({
    progression: 'pokemon-party-picker:rejuv:progression:v1',
    pool: 'pokemon-party-picker:rejuv:owned-pool:v1',
  }),
});
