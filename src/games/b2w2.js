/**
 * The Pokémon Black 2 and White 2 game descriptor (see reborn.js for what
 * each field means). One game for both versions: nothing the engine models
 * differs between them beyond a few version-exclusive pickups, which the
 * item notes name. A mainline game: no game-original items, real trades,
 * reusable machines, and the Generation V learnsets as the legality basis.
 * Its data paths and saved-state keys are namespaced by game id. Item
 * content is curated by hand in b2w2/items.js.
 */
import { EVOLUTION_STONE_FIELDS } from '../reborn/evolution-access.js';
import { B2W2_PROGRESSION_CHECKPOINTS } from '../b2w2/schedule.js';
import {
  B2W2_EVOLUTION_ITEM_AVAILABILITY,
  B2W2_EXTRA_INVENTORY_ITEMS,
  B2W2_ITEM_UNLOCK_BADGES,
  B2W2_SHOP_ITEM_BADGES,
} from '../b2w2/items.js';
import {
  B2W2_HM_OPTIONS,
  B2W2_TM_OPTIONS,
  B2W2_TUTOR_GROUPS,
  B2W2_TUTOR_OPTIONS,
} from '../b2w2/move-sources.js';

// Generation V has no Ice Stone; the other nine stones exist.
const STONE_FIELDS = EVOLUTION_STONE_FIELDS.filter(
  (field) => field.item !== 'Ice Stone',
);

/**
 * The access gates B2W2's progression exposes, in display order. Unova has
 * every location evolution: Chargestone Cave's magnetic field from badge 5,
 * and Pinwheel Forest's Moss Rock and Twist Mountain's Ice Rock after the
 * Champion; the gates let the player say whether they have reached them.
 * @type {!Array<{key: string, label: string, item: (string|undefined)}>}
 */
const B2W2_ACCESS_FIELDS = Object.freeze([
  { key: 'evoAccessFriendship', label: 'Friendship evolutions' },
  ...STONE_FIELDS,
  { key: 'evoAccessOtherEvoItems', label: 'Other evolution items (Metal Coat, Razor Claw, …)' },
  { key: 'evoAccessTrading', label: 'Trade evolutions (need a trade partner; untick if you have none)' },
  { key: 'evoAccessPartyCondition', label: 'Party-condition evolutions (Mantyke needs a Remoraid)' },
  { key: 'evoAccessMagneticField', label: 'Chargestone Cave (Magnezone, Probopass)' },
  { key: 'evoAccessMossyRock', label: 'Pinwheel Forest Moss Rock (Leafeon; after the Champion)' },
  { key: 'evoAccessIcyRock', label: 'Twist Mountain Ice Rock (Glaceon; after the Champion)' },
]);

export const B2W2_GAME = Object.freeze({
  id: 'b2w2',
  label: 'Pokémon Black 2 and White 2',
  shortLabel: 'B2W2',
  dexGen: 5,
  // Loaded on demand: the Gen 5 bundle is its own chunk.
  loadDex: () => import('./dex-gen5.js').then((module) => module.GEN5_DEX),
  families: Object.freeze(['gen5singles', 'gen5doubles']),
  schedule: Object.freeze({
    checkpoints: B2W2_PROGRESSION_CHECKPOINTS,
    itemUnlockBadges: B2W2_ITEM_UNLOCK_BADGES,
  }),
  moveSources: Object.freeze({
    tmOptions: B2W2_TM_OPTIONS,
    tmxOptions: B2W2_HM_OPTIONS,
    tmxLabel: 'HM',
    tutorGroups: B2W2_TUTOR_GROUPS,
    tutorOptions: B2W2_TUTOR_OPTIONS,
  }),
  // No Common Candy and no Type Changer: a level never goes down, and Hidden
  // Power's type follows IVs. Generation V made TMs reusable.
  mechanics: Object.freeze({
    levelDown: false,
    hiddenPowerTypeChanger: false,
    reusableTms: true,
  }),
  // No mining, no replaced items, no game-original held items; the shops are
  // the Driftveil Market, the Battle Subway and PWT prize counters, and the
  // Black City / White Forest stores.
  items: Object.freeze({
    shopItemBadges: B2W2_SHOP_ITEM_BADGES,
    miningItemBadges: Object.freeze({}),
    extraInventoryItems: B2W2_EXTRA_INVENTORY_ITEMS,
    hiddenInventoryItemIds: new Set(),
    inventoryMigration: Object.freeze({}),
    evolutionItemAvailability: B2W2_EVOLUTION_ITEM_AVAILABILITY,
    fieldSeeds: Object.freeze({
      names: Object.freeze([]),
      proxyItems: Object.freeze([]),
      statVectors: Object.freeze({}),
    }),
    typeGems: Object.freeze([]),
  }),
  // Trades are real trades; Feebas evolves by trade holding a Prism Scale
  // here (no Poffins or Beauty), and every location evolution has a place.
  evolution: Object.freeze({
    tradeItem: null,
    tradeAccessKey: 'evoAccessTrading',
    regionAccess: Object.freeze({}),
    unavailableAccessKeys: new Set(['evoAccessOtherLocations']),
    formNotes: Object.freeze({}),
    accessFields: B2W2_ACCESS_FIELDS,
  }),
  rules: Object.freeze({
    legalityBase: Object.freeze({
      generation: 5,
      baseGames: 'B2W2',
      transferMovesAvailableByDefault: false,
    }),
    tmxMoves: [...B2W2_HM_OPTIONS]
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((option) => option.move),
    promotedTmMoves: Object.freeze([]),
    notes: Object.freeze([
      'Move legality follows the Generation V learnsets, counting only the machines and tutors Black 2 and White 2 have.',
      'Level caps are the obedience thresholds: 10 with no badges, then 20, 30, 40, 50, 60, 70, and 80 badge by badge, every level at Wave. In Generation V they bind only traded Pokémon, so playing to them is an honor system; pick "No cap" to switch them off.',
      'Cut, Fly, Surf, Strength, Waterfall, and Dive are HMs. TMs are reusable.',
      'Western Unova (the Route 3 Day Care, Nacrene\'s tutor, Pinwheel Forest), Route 8 and beyond, Twist Mountain, and the Battle Subway and PWT prizes open only after the Champion.',
      'The shard tutors charge 2 to 12 shards of one color per move; shards come from hidden items and dust clouds, so the price is a grind but never a wall.',
      'Event-only moves (Relic Song, Secret Sword) and Dream World abilities are not counted.',
      "Hidden Power's type follows IVs and cannot be changed, so it is never counted as a plannable move.",
      "A set's ability is assumed obtainable at catch (there is no Ability Capsule); declare a caught ability in the pool, as in Snivy (Overgrow), to pin it. Hidden Abilities need the Hidden Grottoes or Dream World and are not counted.",
    ]),
  }),
  // Palette (styles/main.css, app/theme.js): the games' own dark UI, black
  // screens with the Bag's blues. The Pokédex's black ground and panel and
  // its gray frame; the Summary's near-white for text and the PC's gray for
  // muted text; the PC's green, Join Avenue's amber, and the Key Items
  // pocket's red for the state trio; and for the accents the Bag's sky
  // blue (box 1, egg pills), the Bag's deep blue (box 2, tutor pills), the
  // Medicine pocket's green (box 3, level-up pills), and the Pokédex's red
  // (box 4, machine pills), each lightened only as far as AA on the panel
  // and the ground demands.
  theme: Object.freeze({
    scheme: 'dark',
    shell: Object.freeze({
      base: '#101010',
      surface: '#282828',
      hairline: '#424242',
      text: '#e7e7e7',
      textMuted: '#989898',
      ink: '#101010',
    }),
    states: Object.freeze({
      ok: '#88c880',
      warn: '#e8c080',
      blocked: '#ec6262',
    }),
    accents: Object.freeze([
      { name: 'sky', color: '#30b8f8' },
      { name: 'blue', color: '#6691c6' },
      { name: 'green', color: '#639b69' },
      { name: 'red', color: '#d57368' },
    ]),
  }),
  data: Object.freeze({
    legalMovesDir: 'b2w2-legal-moves',
  }),
  storage: Object.freeze({
    progression: 'pokemon-party-picker:b2w2:progression:v1',
    pool: 'pokemon-party-picker:b2w2:owned-pool:v1',
    legacy: Object.freeze({}),
  }),
});
