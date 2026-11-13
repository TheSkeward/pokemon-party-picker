/**
 * @fileoverview Extracts where items come from in a game of the Reborn
 * engine family, straight from an install's compiled data and Ruby sources.
 *
 * Writes four extracts: wild held items, wild encounter tables, item-giving
 * map events, and the Pickup table. The extracts report what the game files
 * say and how each event is gated; deciding when an item becomes obtainable
 * in a playthrough is left to their consumers.
 *
 * Script-side rules (hold chances, Pickup, mining, marts) are parsed out of
 * the Ruby sources and cited by file and line, so a game update that moves
 * or rewrites them fails loudly instead of going stale. The games share the
 * engine but not every rule's place or shape; a game's adapter
 * (ItemSourceAdapter) says where each of its rules lives and how the game
 * differs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Names } from './event-commands.mjs';
import { formatJson } from './format-json.mjs';
import { GameInstall } from './game-files.mjs';
import { extractItemEvents, summarise } from './item-events.mjs';
import {
  extractEncounters,
  mapSwitchReader,
  readNamedSwitches,
} from './map-metadata.mjs';
import { extractPickup } from './pickup.mjs';
import { scriptRuleItems } from './script-item-rules.mjs';
import { extractWildItems } from './wild-items.mjs';

/**
 * What a game tells the extractor about itself.
 *
 * `game` is the title every extract is headed with and `logTag` the name
 * its progress lines go under. `extractStems` names the four files, each
 * written as `<stem>.generated.json`.
 *
 * `version` is the file and pattern (first group) of the version constant.
 * `constantsFile` defines the named switches and the Pickup lists.
 *
 * `holdChances` is where the wild hold-chance rule is rolled: the files,
 * and the reader (wild-items.mjs) they are handed to in that order.
 * `formsInheritWildItems` says whether a form without a wild-item slot of
 * its own holds its base form's.
 *
 * `encounterTypes` lists the encounter tables a map can have, as
 * [type, density] pairs in the order the game reads them; a density names
 * the map rate the type draws on (`land` for `landrate`).
 * `encounterRules` reads what else the encounters extract states for the
 * game, such as how a form-keyed slot picks its form.
 *
 * `scriptRules` reads the script-side item rules map events lean on, each
 * under its key in the extract (script-item-rules.mjs has the readers and
 * the keys). `eventCalls` are the calls the game's events give items with
 * (item-events.mjs).
 * @typedef {{
 *   game: string,
 *   logTag: string,
 *   extractStems: {wildItems: string, encounters: string,
 *       itemEvents: string, pickup: string},
 *   version: {file: string, pattern: !RegExp},
 *   constantsFile: string,
 *   holdChances: {files: !Array<string>,
 *       read: function(...!RubySource): !Object},
 *   formsInheritWildItems: boolean,
 *   encounterTypes: !Array<!Array<string>>,
 *   encounterRules: function(!GameInstall): !Object,
 *   scriptRules: function(!GameInstall): !Object<string, !Object>,
 *   eventCalls: !EventCalls,
 * }}
 */
let ItemSourceAdapter;

// The script every game of the family keeps Kernel.pbPickup in.
const FIELD_SCRIPT = 'Scripts/Field.rb';

/**
 * @param {!Map} items Plain items.dat.
 * @param {!Iterable<string>} symbols
 * @return {!Object<string, string>} Symbol → display name, sorted by symbol;
 *     symbols the game does not define are left out.
 */
function itemNames(items, symbols) {
  const out = {};
  for (const symbol of [...new Set(symbols)].sort()) {
    const item = items.get(symbol);
    if (item) out[symbol] = item.name;
  }
  return out;
}

/**
 * Reads an install and writes the game's four extracts.
 * @param {string} installDir The game's folder.
 * @param {!ItemSourceAdapter} adapter
 * @param {string} outDir Where the extracts are written.
 */
export function extractItemSources(installDir, adapter, outDir) {
  const install = new GameInstall(installDir);
  const { extractStems: stems } = adapter;
  const version = install.source(adapter.version.file)
    .find(adapter.version.pattern).match[1];
  const field = install.source(FIELD_SCRIPT);
  const constants = install.source(adapter.constantsFile);
  const items = install.load('items.dat');
  const mapInfos = install.load('MapInfos.rxdata');
  // An extract is headed with the files it was read from.
  const write = (stem, files, data) => {
    const file = path.join(outDir, `${stem}.generated.json`);
    const source = files.join(' + ');
    const body = { game: adapter.game, version, source, data };
    fs.writeFileSync(file, `${formatJson(body)}\n`);
    const kb = Math.round(fs.statSync(file).size / 1024);
    console.log(`[${adapter.logTag}] ${stem}: ${kb} KB`);
  };

  const wild = extractWildItems(
    install.parse('mons.dat'), adapter.formsInheritWildItems);
  const holdChances = adapter.holdChances.read(
    ...adapter.holdChances.files.map((file) => install.source(file)));
  write(
    stems.wildItems,
    ['mons.dat', ...adapter.holdChances.files, 'items.dat'],
    {
      holdChances,
      itemNames: itemNames(items, wild.items),
      species: wild.species,
    },
  );

  const mapData = install.load('maps.dat');
  const system = install.load('System.rxdata');
  const mapSwitches =
    mapSwitchReader(readNamedSwitches(constants), system);
  const tables = extractEncounters(mapData, mapInfos, adapter.encounterTypes);
  write(
    stems.encounters,
    ['maps.dat', 'MapInfos.rxdata', 'Scripts/Encounters.rb'],
    {
      encounterTypes: adapter.encounterTypes.map(([type, density]) => ({
        type,
        density,
      })),
      ...adapter.encounterRules(install),
      maps: tables.map((entry) => {
        const switches = mapSwitches(mapData[entry.mapId]);
        return switches.length ? { ...entry, mapSwitches: switches } : entry;
      }),
    },
  );

  const pickup = extractPickup(field, constants);
  write(
    stems.pickup,
    [FIELD_SCRIPT, adapter.constantsFile, 'items.dat'],
    {
      itemNames: itemNames(items, [
        ...pickup.lists.PickupNormal.values,
        ...pickup.lists.PickupRare.values,
        ...pickup.relatedAbilities.map((a) => a.item),
      ]),
      ...pickup,
    },
  );

  const scriptRules = adapter.scriptRules(install);
  const names = new Names(system);
  const extracted = extractItemEvents(
    {
      maps: install.maps(),
      commonEvents: install.load('CommonEvents.rxdata'),
      mapInfos,
    },
    names,
    adapter.eventCalls,
    scriptRules.itemPools,
  );
  const { items: eventItems, ...summary } = summarise(extracted.events);
  const allItems = [
    ...eventItems,
    ...scriptRuleItems(scriptRules),
    ...extracted.commonEvents.flatMap((ce) => ce.gives.map((g) => g.item)),
  ].filter(Boolean);
  write(
    stems.itemEvents,
    [
      'Map###.rxdata', 'CommonEvents.rxdata', 'System.rxdata',
      'MapInfos.rxdata', 'maps.dat', 'items.dat', 'Scripts',
    ],
    {
      summary: {
        ...summary,
        unknownItems: [...new Set(allItems)]
          .filter((symbol) => !items.has(symbol))
          .sort(),
      },
      itemNames: itemNames(items, allItems),
      scriptRules,
      storyMarkers: {
        badgeAwards: extracted.badgeAwards,
        ...names.index(),
      },
      maps: Object.fromEntries(
        [...mapInfos]
          .sort((a, b) => a[0] - b[0])
          .map(([id, info]) => {
            const switches = mapSwitches(mapData[id]);
            return [id, {
              name: info.name,
              parentId: info.parent_id,
              ...(switches.length ? { mapSwitches: switches } : {}),
            }];
          }),
      ),
      commonEvents: extracted.commonEvents,
      coinSources: extracted.coinSources,
      selfSwitchResets: extracted.selfSwitchResets,
      events: extracted.events,
    },
  );
  console.log(JSON.stringify(summary, null, 2));
}

/**
 * Runs a game's extractor from the command line: `node <entry> <install>`.
 * The extracts are written beside the entry script.
 * @param {!ItemSourceAdapter} adapter
 * @param {string} entryUrl The entry script's import.meta.url.
 */
export function runItemSourceExtractor(adapter, entryUrl) {
  const entry = fileURLToPath(entryUrl);
  const installDir = process.argv[2];
  if (!installDir) {
    const script = path.relative(process.cwd(), entry).replaceAll('\\', '/');
    console.error(`Usage: node ${script} <install-path>`);
    process.exit(1);
  }
  extractItemSources(installDir, adapter, path.dirname(entry));
}
