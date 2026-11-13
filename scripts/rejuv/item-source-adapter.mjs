/**
 * @fileoverview Where Pokémon Rejuvenation keeps the rules its item sources
 * are extracted from, for essentials/extract-item-sources.mjs.
 *
 * Known omissions:
 *   - Rejuv/LuckContractHandlers.rb replaces a wild Pokémon's held item
 *     with a Black Prism at 1 in 100 (more often on some maps, with
 *     Shayda's Charm on the lead, or under a luck contract). The hold
 *     chances here are the ones rolled before that.
 *   - The hold-chance handler's Item Drink branch never runs: the game
 *     defines no DrinkItems variable.
 *   - Mart.rb still defines pbDefaultMart, but no event calls it.
 */
import {
  ENGINE_GIVE_CALLS,
  setSelfSwitchesResets,
} from '../essentials/item-events.mjs';
import { readSlotFormRule } from '../essentials/map-metadata.mjs';
import {
  readBerryData,
  readItemPools,
  readMartData,
  readMiningTable,
} from '../essentials/script-item-rules.mjs';
import { readCreationHandlerHoldChances } from '../essentials/wild-items.mjs';

/** @const {!ItemSourceAdapter} */
export const REJUV_ITEM_SOURCE_ADAPTER = {
  game: 'Pokemon Rejuvenation',
  logTag: 'rejuv-item-sources',
  extractStems: {
    wildItems: 'rejuv-wild-items',
    // maps.dat's tables, which the game loads. rejuv-encounters is the
    // older extract of encounters.dat, the map editor's copy.
    encounters: 'rejuv-map-encounters',
    itemEvents: 'rejuv-item-events',
    pickup: 'rejuv-pickup',
  },
  version: {
    file: 'Scripts/Rejuv/Bootstrap.rb',
    pattern: /^GAME_VERSION = '([^']+)'/,
  },
  constantsFile: 'Scripts/Rejuv/SystemConstants.rb',

  // A handler of Events.onWildPokemonCreate rolls the held item, from
  // MonData#getWildItems, which reads the form's own flags and nothing
  // else.
  holdChances: {
    files: ['Scripts/EncounterModifiers.rb', 'Scripts/DataObjects.rb'],
    read: readCreationHandlerHoldChances,
  },
  formsInheritWildItems: false,

  // Encounters.rb, EncounterTypes, with the rate PokemonEncounters#setup
  // gives each.
  encounterTypes: [
    ['Land', 'land'],
    ['Cave', 'cave'],
    ['Water', 'water'],
    ['RockSmash', 'cave'],
    ['OldRod', 'water'],
    ['GoodRod', 'water'],
    ['SuperRod', 'water'],
    ['Headbutt', 'land'],
    ['LandMorning', 'land'],
    ['LandDay', 'land'],
    ['LandNight', 'land'],
    ['BugContest', 'land'],
    ['Lava', 'lava'],
  ],
  // A table may key a slot by species and form.
  encounterRules: (install) => ({
    slotForms: readSlotFormRule(install.source('Scripts/Encounters.rb')),
  }),

  scriptRules: (install) => ({
    // RejuvCustomScripts.rb reopens MiningGameScene after Minigame/Mining.rb
    // has loaded (Rejuv/Bootstrap.rb) and replaces its table; the game
    // itself is still the base script's.
    mining: readMiningTable(
      install.source('Scripts/Rejuv/RejuvCustomScripts.rb'),
      install.source('Scripts/Minigame/Mining.rb')),
    marts: readMartData(install),
    berryPlants: readBerryData(
      install, install.source('Scripts/BerryPlants.rb')),
    itemPools: {
      luckItem: readItemPools(
        install.source('Scripts/Rejuv/Xenpurgis/LuckSwap.rb'),
        'luckItemPool'),
      generateWonderTowerItem: readItemPools(
        install.source('Scripts/Rejuv/WonderTower.rb'),
        'wonderTowerItemPool'),
    },
  }),

  eventCalls: {
    // addItemSilent (Field.rb) stores without a message; the vending
    // machines use it.
    gives: { ...ENGINE_GIVE_CALLS, addItemSilent: 'store' },
    defaultMart: null,
    dataMart: 'pbComplexMart',
    // luckItem(quantity, rolls, pool) and generateWonderTowerItem(pool)
    // each end in Kernel.pbItemBall. How many are found stays in the
    // give's `call`.
    poolDraws: {
      luckItem: { poolArgument: 2, defaultPool: 'itemball' },
      generateWonderTowerItem: { poolArgument: 0 },
    },
    // pbSetEventTimeMultiMap stamps the event's own clock as pbSetEventTime
    // does, and other maps' events with it.
    eventTimers: ['pbSetEventTime', 'pbSetEventTimeMultiMap'],
    // Rejuv/Eventing/Self Switch Off.rb.
    selfSwitchResets: setSelfSwitchesResets,
  },
};
