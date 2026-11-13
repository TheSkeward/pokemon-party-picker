/**
 * @fileoverview Where Pokémon Reborn keeps the rules its item sources are
 * extracted from, for essentials/extract-item-sources.mjs.
 */
import {
  ENGINE_GIVE_CALLS,
  selfSwitchLoopResets,
} from '../essentials/item-events.mjs';
import {
  readBerryValues,
  readDefaultMart,
  readMiningTable,
} from '../essentials/script-item-rules.mjs';
import { readGeneratorHoldChances } from '../essentials/wild-items.mjs';

/** @const {!ItemSourceAdapter} */
export const REBORN_ITEM_SOURCE_ADAPTER = {
  game: 'Pokemon Reborn',
  logTag: 'reborn-item-sources',
  extractStems: {
    wildItems: 'reborn-wild-items',
    encounters: 'reborn-encounters',
    itemEvents: 'reborn-item-events',
    pickup: 'reborn-pickup',
  },
  version: {
    file: 'Scripts/Reborn/Bootstrap.rb',
    pattern: /^GAMEVERSION = '([^']+)'/,
  },
  constantsFile: 'Scripts/Reborn/SystemConstants.rb',

  // pbGenerateWildPokemon rolls the held item itself, from
  // PokeBattle_Pokemon#wildHoldItems, which reads each slot through
  // checkFlag? and so falls back to the base form.
  holdChances: { files: ['Scripts/Field.rb'], read: readGeneratorHoldChances },
  formsInheritWildItems: true,

  // Encounters.rb, EncounterTypes. PokemonEncounters#setup gives the Super
  // Rod the land rate.
  encounterTypes: [
    ['Land', 'land'],
    ['Cave', 'cave'],
    ['Water', 'water'],
    ['RockSmash', 'cave'],
    ['OldRod', 'water'],
    ['GoodRod', 'water'],
    ['SuperRod', 'land'],
    ['Headbutt', 'land'],
    ['LandMorning', 'land'],
    ['LandDay', 'land'],
    ['LandNight', 'land'],
    ['BugContest', 'land'],
  ],
  // A table keys its slots by species alone.
  encounterRules: () => ({}),

  scriptRules: (install) => ({
    mining: readMiningTable(install.source('Scripts/MinigameMining.rb')),
    defaultMart: readDefaultMart(install.source('Scripts/Mart.rb')),
    berryPlants: readBerryValues(install.source('Scripts/BerryPlants.rb')),
  }),

  eventCalls: {
    gives: ENGINE_GIVE_CALLS,
    defaultMart: 'pbDefaultMart',
    dataMart: null,
    poolDraws: {},
    eventTimers: ['pbSetEventTime'],
    selfSwitchResets: selfSwitchLoopResets,
  },
};
