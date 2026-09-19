/**
 * @fileoverview Evolution legality-with-friction. One uniform rule set —
 * nothing mon-specific, no verdict fitting:
 *
 *   level evolution:      legal if the cap permits, K = 0
 *   friendship:           legal, K = friendship grind
 *   move-based:           legal once the pre-evo can have learned the move
 *                         (gated by the move's learn level vs the cap)
 *   item / hold / trade:  legal if the item is farmable (curated, sourced
 *                         table), K = item friction (higher when tedious);
 *                         UNKNOWN item availability is surfaced, not silently
 *                         blocked or allowed
 *   special condition:    affection ⇒ friendship-like; trivial party/time
 *                         conditions ⇒ minor friction; location evolutions
 *                         (moss/ice rock, magnetic field, Lanakila equivalent)
 *                         ⇒ legal with item-level friction when the game has
 *                         the location, blocked when it does not
 *
 * Everything game-specific — what replaces trading, which gate stands in for
 * a region, which locations the game lacks, form notes, the gate list — comes
 * from the active game's evolution rules (games/evolution.js).
 *
 * If a correct requirement model makes some line good, it competes; if that
 * looks wrong, the fix is C/K/utility — never a special legality rule.
 */

import { toId } from '../utils/ids.js';
import { getItemAvailability } from '../games/items.js';
import { accessFields, evolutionRules } from '../games/evolution.js';
import { getActiveGame } from '../games/registry.js';
import { tunable } from '../teamBuilder/scoring-constants.js';
import { dex } from '../games/dex.js';

const TEDIOUS_MULTIPLIER = 1.5;


// A region-locked evolution (dex evoRegion) needs the game's stand-in for
// that region — the stone alone isn't enough — unless the game exempts the
// species (Reborn lets Cubone pick Marowak's form by time of day).
function regionAccess(species) {
  const region = species?.evoRegion;
  const entry = region ? evolutionRules().regionAccess?.[region] : null;
  if (!entry || (entry.except || []).includes(species.id)) return null;
  return entry;
}

function ownedItemCount(access, itemName) {
  if (!access?.ownedItems) return 0;
  const id = toId(itemName);
  return id ? access.ownedItems[id] || 0 : 0;
}

// Item-shaped gates per game, keyed by its access-field list.
const ITEM_GATES = new WeakMap();
function itemGates() {
  const fields = accessFields();
  let gates = ITEM_GATES.get(fields);
  if (gates) return gates;
  const stoneKeyByItemId = new Map(
    fields.filter((field) => field.item).map((field) => [
      toId(field.item),
      field.key,
    ]),
  );
  gates = {
    stoneKeyByItemId,
    keys: new Set([...stoneKeyByItemId.values(), 'evoAccessOtherEvoItems']),
  };
  ITEM_GATES.set(fields, gates);
  return gates;
}

function evoItemAccessKey(evoItem) {
  return (
    itemGates().stoneKeyByItemId.get(toId(evoItem)) || 'evoAccessOtherEvoItems'
  );
}

function accessLabel(key) {
  return accessFields().find((field) => field.key === key)?.label || key;
}

function requiredAccessKeys(evoType, condition, species) {
  const region = regionAccess(species);
  const regionKeys = region ? [region.accessKey] : [];
  if (evoType === 'levelFriendship') return ['evoAccessFriendship', ...regionKeys];
  if (evoType === 'trade') {
    // Trade-with-item (Metal Coat Scizor) needs the item too.
    const tradeKeys = [evolutionRules().tradeAccessKey].filter(Boolean);
    return species.evoItem
      ? [...tradeKeys, evoItemAccessKey(species.evoItem), ...regionKeys]
      : [...tradeKeys, ...regionKeys];
  }
  if (evoType === 'useItem' || evoType === 'levelHold') {
    return [evoItemAccessKey(species.evoItem), ...regionKeys];
  }
  if (evoType === '') return regionKeys;
  if (evoType === 'levelExtra') {
    if (/affection/i.test(condition)) return ['evoAccessFriendship', ...regionKeys];
    if (/magnetic field/i.test(condition)) return ['evoAccessMagneticField'];
    if (/moss rock/i.test(condition)) return ['evoAccessMossyRock'];
    if (/ice rock/i.test(condition)) return ['evoAccessIcyRock'];
    // "with a Remoraid in party" is NOT trivial — it needs a specific mon the
    // player may not own; gate it like the other special methods.
    if (/party/i.test(condition)) return ['evoAccessPartyCondition'];
    return ['evoAccessOtherLocations'];
  }
  return [];
}

/**
 * The requirement for evolving INTO `species` from its direct pre-evolution.
 * `levelRequired` still needs checking against the level cap by the caller;
 * `friction` is in score points (K). `access` is the progression object (flat
 * evoAccess* booleans); omitted = everything accessible.
 * @param {?Object} species Dex entry of the evolved form.
 * @param {?Object=} access
 * @return {?{status: string, levelRequired: ?number, friction: number,
 *     method: string, reason: string}} status is "legal" | "unknown" |
 *     "blocked"; null for a null species.
 */
export function getEvolutionRequirement(species, access = null) {
  if (!species) return null;
  if (!species.prevoId) {
    return { status: 'legal', levelRequired: null, friction: 0, method: 'base', reason: 'base form' };
  }
  if (species.isMega) {
    return {
      status: 'unknown',
      levelRequired: null,
      friction: 0,
      method: 'mega',
      reason: 'mega forms are handled by the mega slot, not evolution',
    };
  }

  const evoType = species.evoType || '';
  const condition = species.evoCondition || '';
  const rules = evolutionRules();
  const required = requiredAccessKeys(evoType, condition, species);

  // A method the game simply lacks (no Moss Rock anywhere in it) is blocked
  // regardless of progression: a fact about the game, not the player.
  const missing = required.find((key) => rules.unavailableAccessKeys.has(key));
  if (missing) {
    return {
      status: 'blocked',
      levelRequired: null,
      friction: 0,
      method: evoType || 'level',
      reason: `${accessLabel(missing)} does not exist in ${getActiveGame().shortLabel}`,
    };
  }

  // Access gate first: a method the player can't use yet is BLOCKED — a
  // concrete, user-stated fact that outranks the friction model. Surfaced,
  // never silent. Owning the required item overrides its gate (a Thunder
  // Stone in the bag works even if stones "aren't accessible yet").
  if (access) {
    const denied = required.find(
      (key) => {
        const itemGate = itemGates().keys.has(key);
        // Legacy saves: the old blanket `evoAccessStones: false` blocks every
        // item gate whose per-item key hasn't been set explicitly.
        const blocked =
          access[key] === false ||
          (itemGate && access[key] === undefined &&
            access.evoAccessStones === false);
        if (!blocked) return false;
        if (itemGate && ownedItemCount(access, species.evoItem)) {
          return false;
        }
        if (
          key === rules.tradeAccessKey &&
          rules.tradeItem &&
          ownedItemCount(access, rules.tradeItem)
        ) {
          return false;
        }
        return true;
      },
    );
    if (denied) {
      return {
        status: 'blocked',
        levelRequired: null,
        friction: 0,
        method: evoType || 'level',
        reason: `${accessLabel(denied)} not yet accessible (${getActiveGame().shortLabel} Progression setting)`,
      };
    }
  }

  if (evoType === '') {
    // Plain level evolution; a trivial rider (day/night, gender) adds minor
    // friction but doesn't gate legality.
    return {
      status: 'legal',
      levelRequired:
        Number.isFinite(species.evoLevel) ? species.evoLevel : null,
      friction: condition ? tunable('TIME_FRICTION') : 0,
      method: 'level',
      reason: condition
        ? `level ${species.evoLevel} (${condition})`
        : `level ${species.evoLevel}`,
    };
  }

  if (evoType === 'levelFriendship') {
    return {
      status: 'legal',
      levelRequired: null,
      friction: tunable('FRIENDSHIP_FRICTION'),
      method: 'friendship',
      reason: condition ? `friendship (${condition})` : 'friendship grind',
    };
  }

  if (evoType === 'levelMove') {
    // Legal once the pre-evo can have LEARNED the required move on the natural
    // path — gated by the recorded learn level. No recorded level ⇒ unknown.
    if (!Number.isFinite(species.evoMoveLevel)) {
      return {
        status: 'unknown',
        levelRequired: null,
        friction: 0,
        method: 'move',
        reason: `requires knowing ${species.evoMove || 'a move'} — learn level unknown`,
      };
    }
    return {
      status: 'legal',
      levelRequired: species.evoMoveLevel,
      friction: tunable('TIME_FRICTION'),
      method: 'move',
      reason: `level-up knowing ${species.evoMove} (learned at ${species.evoMoveLevel})`,
    };
  }

  if (evoType === 'levelHold' || evoType === 'useItem' || evoType === 'trade') {
    const parts = [];
    let friction = 0;
    // A trade is priced as the game prices it: an item that replaces trading
    // (Reborn's Link Stone, itself farmable) or a trade as such.
    if (evoType === 'trade') {
      parts.push(
        rules.tradeItem
          ? {
            item: rules.tradeItem,
            trade: true,
            ...getItemAvailability(rules.tradeItem),
          }
          : {
            item: 'trade',
            trade: true,
            status: 'farmable',
            source: 'trade evolution',
          },
      );
    }
    if (species.evoItem) {
      parts.push(
        { item: species.evoItem, ...getItemAvailability(species.evoItem) });
    }
    if (evoType === 'useItem' && !species.evoItem) {
      return {
        status: 'unknown',
        levelRequired: null,
        friction: 0,
        method: 'item',
        reason: 'item evolution with no recorded item',
      };
    }
    // Owned items are settled facts — mark them before the availability check
    // so "availability unknown" can't block an item that's already in the bag.
    for (const part of parts) {
      if (ownedItemCount(access, part.item)) part.owned = true;
    }
    const unknown = parts.find(
      (part) => part.status === 'unknown' && !part.owned,
    );
    if (unknown) {
      return {
        status: 'unknown',
        levelRequired: null,
        friction: 0,
        method: evoType === 'trade' ? 'trade' : 'item',
        reason: `${unknown.item} availability unknown (${unknown.source})`,
      };
    }
    for (const part of parts) {
      // An owned item costs nothing to "acquire" — friction models the grind
      // of getting it, and it's already in the bag.
      if (part.owned) continue;
      const base =
        part.trade ? tunable('TRADE_FRICTION') : tunable('ITEM_FRICTION');
      friction +=
        part.status === 'farmable-tedious'
          ? Math.round(base * TEDIOUS_MULTIPLIER)
          : base;
    }
    const how = parts
      .map((part) =>
        part.owned
          ? `${part.item} (owned)`
          : `${part.item} (${part.status}: ${part.source})`,
      )
      .join(' + ');
    const riders = [condition, regionAccess(species)?.label || '']
      .filter(Boolean)
      .join(', ');
    return {
      status: 'legal',
      levelRequired: null,
      friction,
      method: evoType === 'trade' ? 'trade' : 'item',
      reason: riders ? `${how}, ${riders}` : how,
    };
  }

  if (evoType === 'levelExtra') {
    if (/affection/i.test(condition)) {
      return {
        status: 'legal',
        levelRequired: null,
        friction: tunable('FRIENDSHIP_FRICTION'),
        method: 'affection',
        reason: condition,
      };
    }
    if (/party/i.test(condition)) {
      return {
        status: 'legal',
        levelRequired: null,
        friction: tunable('TIME_FRICTION'),
        method: 'condition',
        reason: condition,
      };
    }
    // Location evolutions (moss/ice rock, magnetic field, Lanakila-equivalent)
    // the game has (the ones it lacks were blocked above) open up over the
    // midgame. Legal with item-level friction; the condition is surfaced in
    // the proof.
    return {
      status: 'legal',
      levelRequired: null,
      friction: tunable('ITEM_FRICTION'),
      method: 'location',
      reason: `${condition || 'special location'} (${getActiveGame().shortLabel} location, midgame)`,
    };
  }

  return {
    status: 'unknown',
    levelRequired: null,
    friction: 0,
    method: evoType,
    reason: `unhandled evolution type ${evoType}`,
  };
}

// Form-split requirements the dex has no structured fields for (gender locks
// and Burmy's cloak-by-location). Reviewed by hand; display-only. A game's
// own notes (evolution rules formNotes) override these per species.
const FORM_EVOLUTION_NOTES = Object.freeze({
  wormadam: 'Female, in grass',
  wormadamsandy: 'Female, in caves',
  wormadamtrash: 'Female, in buildings',
  mothim: 'Male',
  vespiquen: 'Female',
  gallade: 'Male',
  froslass: 'Female',
  salazzle: 'Female',
  shedinja: 'spare party slot and a Poké Ball',
});

// One evolution step INTO `species`, compressed for display: `level` when it's
// a plain level-up (rendered as "@20" against the pre-evo's name), and `text`
// for everything else the player must do ("hold Oval Stone, during the day",
// "Link Stone + Metal Coat", "near a Moss Rock", "Female, in buildings").
function shortStepRequirement(species) {
  const rules = evolutionRules();
  const note =
    rules.formNotes?.[species.id] ?? FORM_EVOLUTION_NOTES[species.id];
  const condition = species.evoCondition || '';
  const evoType = species.evoType || '';
  const region = regionAccess(species)?.label || '';
  const extras = (base) =>
    [base, note || condition || '', region].filter(Boolean).join(', ');

  if (evoType === '') {
    return {
      level: Number.isFinite(species.evoLevel) ? species.evoLevel : null,
      text: extras('') || null,
    };
  }
  if (evoType === 'levelFriendship') return { level: null, text: extras('friendship') };
  if (evoType === 'levelMove') {
    return { level: null, text: extras(`knowing ${species.evoMove || 'a move'}`) };
  }
  if (evoType === 'useItem') {
    return { level: null, text: extras(species.evoItem || 'an item') };
  }
  if (evoType === 'levelHold') {
    return { level: null, text: extras(`hold ${species.evoItem || 'an item'}`) };
  }
  if (evoType === 'trade') {
    const via = rules.tradeItem || 'trade';
    return {
      level: null,
      text: extras(`${via}${species.evoItem ? ` + ${species.evoItem}` : ''}`),
    };
  }
  // levelExtra and anything else: the recorded condition IS the requirement.
  return { level: null, text: extras('') || 'special condition' };
}

/**
 * Human note for "what it takes" to evolve `fromId` into `toId`, appended to
 * the input mon's name: Burmy -> Wormadam-Trash reads "@20 (Female, in
 * buildings)"; Happiny -> Blissey reads " (hold Oval Stone, during the day,
 * then friendship)". Empty string when `fromId` isn't a strict ancestor of
 * `toId` (nothing to explain). Static game mechanics only — gamestate (owned
 * items, access gates) is deliberately not consulted, so the note is stable.
 * @param {?string} fromId
 * @param {?string} toId
 * @return {string}
 */
export function describeEvolutionPath(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return '';
  const chain = [];
  let id = toId;
  const seen = new Set();
  while (id && id !== fromId && !seen.has(id)) {
    seen.add(id);
    const species = dex().progressionSpecies[id];
    if (!species?.prevoId) return '';
    chain.unshift(species);
    id = species.prevoId;
  }
  if (id !== fromId || !chain.length) return '';

  let steps = chain.map(shortStepRequirement);
  // A leading run of unconditioned level-ups collapses to its last level:
  // Weedle -> Beedrill is "@10", not "@7 (then @10)" — reaching the final
  // level implies the intermediate one.
  while (
    steps.length > 1 &&
    steps[0].level != null &&
    !steps[0].text &&
    steps[1].level != null &&
    !steps[1].text
  ) {
    steps = steps.slice(1);
  }
  let attachedLevel = '';
  const tokens = [];
  steps.forEach((step, index) => {
    if (index === 0 && step.level != null) {
      attachedLevel = `@${step.level}`;
      if (step.text) tokens.push(step.text);
      return;
    }
    const text =
      step.level != null
        ? [`@${step.level}`, step.text].filter(Boolean).join(', ')
        : step.text;
    if (!text) return;
    // A token from a LATER step reads as a sequence: "@21 (then Leaf Stone)".
    tokens.push(index > 0 && (attachedLevel || tokens.length) ? `then ${text}` : text);
  });

  return `${attachedLevel}${tokens.length ? ` (${tokens.join(', ')})` : ''}`;
}

/**
 * Walks from the fielded form down toward the family base, or — when the
 * player's input form is on the chain — stops there: evolutions below the
 * owned form are already done, so they carry no pending requirement and no
 * friction (an input Alakazam owes nothing for Kadabra → Alakazam).
 * @return {{friction: number, steps: Array<{from: string, to: string,
 *     method: string, friction: number, reason: string}>}} steps in
 *     base-to-fielded order; friction is the steps' total (K).
 */
export function evolutionChainProof(fieldedId, access = null, inputId = null) {
  const steps = [];
  let friction = 0;
  let id = fieldedId;
  const seen = new Set();
  while (id && id !== inputId && !seen.has(id)) {
    seen.add(id);
    const species = dex().progressionSpecies[id];
    if (!species || !species.prevoId) break;
    const requirement = getEvolutionRequirement(species, access);
    steps.unshift({
      from: species.prevoId,
      to: species.id,
      method: requirement.method,
      friction: requirement.friction,
      reason: requirement.reason,
    });
    friction += requirement.friction;
    id = species.prevoId;
  }
  return { friction, steps };
}
