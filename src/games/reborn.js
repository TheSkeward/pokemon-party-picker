/**
 * The Pokémon Reborn game descriptor. A descriptor names everything about a
 * game the ENGINE must not hardcode: where its extracted data lives, which
 * localStorage keys hold its per-playthrough state, and which dex generation
 * its species/move data is built from.
 *
 * Reborn predates the registry, so its data paths and storage keys keep their
 * original un-namespaced literal values: renaming the paths would orphan every
 * deployed data manifest, and renaming the keys would silently discard every
 * existing player's saved pool and progression. New games namespace both by
 * game id.
 */
import { GEN7_DEX } from './dex-gen7.js';
import { REBORN_ITEM_UNLOCK_BADGES } from '../generated/rebornItemTimeline.generated.js';
import { REBORN_PROGRESSION_CHECKPOINTS } from '../reborn/badge-timeline.js';
import {
  REBORN_TM_OPTIONS,
  REBORN_TMX_OPTIONS,
  REBORN_TUTOR_GROUPS,
  REBORN_TUTOR_OPTIONS,
} from '../reborn/progression-options.js';
import {
  REBORN_MOVE_LEGALITY_BASE,
  REBORN_PROGRESSION_NOTES,
  REBORN_PROMOTED_TM_MOVES,
  REBORN_TMX_MOVES,
} from '../reborn/rules.js';

export const REBORN_GAME = Object.freeze({
  id: 'reborn',
  label: 'Pokémon Reborn',
  // The generated mainline data the engine reads through dex() (games/dex.js).
  dexGen: 7,
  dex: GEN7_DEX,
  // The progression timeline (games/schedule.js reads it): checkpoints in
  // play order plus the generated first-obtainable badge per held item.
  schedule: Object.freeze({
    checkpoints: REBORN_PROGRESSION_CHECKPOINTS,
    itemUnlockBadges: REBORN_ITEM_UNLOCK_BADGES,
  }),
  // Machine and tutor tables with pickup timing (games/legality.js).
  moveSources: Object.freeze({
    tmOptions: REBORN_TM_OPTIONS,
    tmxOptions: REBORN_TMX_OPTIONS,
    tutorGroups: REBORN_TUTOR_GROUPS,
    tutorOptions: REBORN_TUTOR_OPTIONS,
  }),
  rules: Object.freeze({
    legalityBase: REBORN_MOVE_LEGALITY_BASE,
    tmxMoves: REBORN_TMX_MOVES,
    promotedTmMoves: REBORN_PROMOTED_TM_MOVES,
    notes: REBORN_PROGRESSION_NOTES,
  }),
  data: Object.freeze({
    legalMovesDir: 'reborn-legal-moves',
    itemAvailability: 'reborn-item-availability.extracted.json',
  }),
  storage: Object.freeze({
    progression: 'pokemon-usage-viewer:reborn-progression:v1',
    pool: 'pokemon-usage-viewer:owned-pool:v1',
  }),
});
