import { toId } from './utils/ids.js';
import { dex } from './games/dex.js';

const TYPE_COLORS = {
  Normal: '#A8A77A',
  Fire: '#EE8130',
  Water: '#6390F0',
  Electric: '#F7D02C',
  Grass: '#7AC74C',
  Ice: '#96D9D6',
  Fighting: '#C22E28',
  Poison: '#A33EA1',
  Ground: '#E2BF65',
  Flying: '#A98FF3',
  Psychic: '#F95587',
  Bug: '#A6B91A',
  Rock: '#B6A136',
  Ghost: '#735797',
  Dragon: '#6F35FC',
  Dark: '#705746',
  Steel: '#B7B7CE',
  Fairy: '#D685AD',
};

const CATEGORY_COLORS = {
  Physical: '#E85D75',
  Special: '#5DA9E9',
  Status: '#9AA5B1',
};

const VALID_TYPES = new Set(Object.keys(TYPE_COLORS));

// Moves that act on or through a partner and so do nothing with no ally on
// the field: a singles family never recommends or scores them. The dex has
// no flag for this, and their priority values would otherwise rank them
// among the best status fillers.
const PARTNER_ONLY_MOVES = new Set([
  'helpinghand',
  'allyswitch',
  'followme',
  'ragepowder',
  'spotlight',
  'wideguard',
  'quickguard',
  'afteryou',
  'instruct',
  'healpulse',
  'aromaticmist',
]);

/**
 * @param {string} id Move id.
 * @param {string} family Battle family id ("singles", "gen5doubles", ...).
 * @return {boolean} True when the move needs a partner the family never has.
 */
export function isInertInFamily(id, family) {
  return PARTNER_ONLY_MOVES.has(toId(id)) && !/doubles/i.test(String(family));
}

/** @return {!Array<string>} Every type name the palette covers. */
export function listTypeNames() {
  return [...VALID_TYPES];
}

const cache = new Map();

/**
 * @param {string} name Move display name.
 * @return {?Object} Move metadata, or null when unknown.
 */
export function getMoveMeta(name) {
  const rawName = String(name || '').trim();
  const id = toId(rawName);
  if (!id) return null;
  if (cache.has(id)) return cache.get(id);

  // Hidden Power's elemental type lives in the move name, not in the base dex
  // entry. Accept every representation used across the app and scraped teams:
  // "Hidden Power Ice", "Hidden Power [Ice]", and "hiddenpowerice".
  const meta = resolveHiddenPower(rawName) || dex().moveMeta[id] || null;
  cache.set(id, meta);
  return meta;
}

function resolveHiddenPower(name) {
  const match = /^hiddenpower([a-z]+)$/.exec(toId(name));
  if (!match) return null;

  const type = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
  if (!VALID_TYPES.has(type)) return null;

  // Gen 7: Hidden Power is always 60 BP / 100% acc regardless of type.
  return {
    name: `Hidden Power ${type}`,
    type,
    category: 'Special',
    basePower: 60,
    accuracy: 100,
  };
}

/**
 * @param {string} id
 * @return {?Object}
 */
export function getMoveMetaById(id) {
  return getMoveMeta(id);
}

/**
 * Rejoins a stripped legal-move entry ({ id, sources }) with its central
 * metadata, reproducing the fully-populated move object the rest of the app
 * consumes, including screen mechanics. Unknown ids fall back to inert
 * defaults so a missing entry can't crash a render.
 */
export function hydrateLegalMove(rawMove) {
  const meta = getMoveMetaById(rawMove.id);
  return {
    id: rawMove.id,
    name: meta?.name ?? rawMove.id,
    type: meta?.type ?? 'Normal',
    category: meta?.category ?? 'Status',
    basePower: meta?.basePower ?? 0,
    priority: meta?.priority ?? 0,
    utility: meta?.utility ?? false,
    // Utility role kinds (recovery / setup / hazard_set / speed_control / ...),
    // so utility scoring can value real team infrastructure over chip status.
    roles: meta?.roles ?? [],
    // Per-action screen coverage and any weather gate. This lets scoring
    // distinguish Aurora Veil from one-axis screens without naming a user.
    screenAxes: meta?.screenAxes ?? [],
    requiresWeather: meta?.requiresWeather,
    // Hit rate (0–100) so the damage estimate can weight by expected accuracy.
    accuracy: meta?.accuracy ?? 100,
    // Multi-hit / recharge / charge flags feed the effective-power damage
    // model.
    multihit: meta?.multihit,
    recharge: meta?.recharge ?? false,
    charge: meta?.charge ?? false,
    // Ability-interaction flags (contact/punch/bite/pulse/sound/recoil/
    // secondary) — which abilities boost or convert this move is decided by
    // these move properties (damageModel.getAbilityDamageMultiplier).
    flags: meta?.flags ?? {},
    // Flinch chance (0–100), priced as a denied action by a faster user.
    flinch: meta?.flinch ?? 0,
    // The foe's stats a status move lowers ('atk', 'accuracy', ...).
    lowers: meta?.lowers ?? [],
    // The user's own stats a move raises and drops (stat -> stages), the
    // status it inflicts, its PP, the share of HP it spends and the weight
    // it sheds: what a stand-in comparison and side-effect pricing read.
    raises: meta?.raises ?? {},
    selfDrops: meta?.selfDrops ?? {},
    inflicts: meta?.inflicts ?? null,
    pp: meta?.pp ?? 0,
    hpCost: meta?.hpCost ?? 0,
    weightChangeKg: meta?.weightChangeKg ?? 0,
    sources: rawMove.sources,
  };
}

/**
 * One-line move facts for tooltips: "Rock · Physical · 100 BP · 80% acc",
 * with priority only when it isn't 0 ("+2 priority"). Status moves skip BP.
 * Empty string for unknown moves so callers can omit the tooltip.
 * @return {string}
 */
export function describeMoveMeta(meta) {
  if (!meta) return '';
  const parts = [meta.type, meta.category];
  if (meta.category !== 'Status' && meta.basePower > 0) {
    parts.push(`${meta.basePower} BP`);
  }
  parts.push(`${meta.accuracy ?? 100}% acc`);
  if (meta.priority) {
    parts.push(`${meta.priority > 0 ? '+' : ''}${meta.priority} priority`);
  }
  return parts.filter(Boolean).join(' · ');
}

/** @return {string} CSS color for the type; neutral gray when unknown. */
export function getTypeColor(type) {
  return TYPE_COLORS[type] || '#AAB5C3';
}

/** @return {string} CSS color for the category; neutral gray when unknown. */
export function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || '#AAB5C3';
}

/**
 * Inline style for a badge filled with a type or category color: the fill
 * and whichever badge ink (styles/main.css) contrasts more with it. The
 * palettes are drawn for light text but half of them are too pale for it.
 * @param {string} color A `#rrggbb` fill.
 * @return {string}
 */
export function badgeStyle(color) {
  const channel = (index) => {
    const value = parseInt(color.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  // The relative luminance at which the light and dark inks contrast
  // equally with the fill.
  const ink = luminance > 0.18 ? 'dark' : 'light';
  return `background:${color};color:var(--badge-ink-${ink});`;
}
