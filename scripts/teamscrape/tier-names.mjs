/**
 * @fileoverview Tier and generation names as they appear in thread and
 * subforum titles and in the section headings of tournament team dumps,
 * shared by the scrapers that attribute a format from free text (RMT's
 * generation-labeled threads, the competitive-discussion forum walk, the
 * tournament dumps).
 */

// Most-specific first: "Doubles UU" must not read as UU, and "OU" appears
// inside almost every compound tier name.
const TIER_PATTERNS = [
  ['doublesubers', /\bdoubles?\s*ubers\b/i],
  ['doublesuu', /\bdoubles?\s*uu\b/i],
  ['doublesou', /\bdoubles\b/i],
  ['anythinggoes', /\banything\s*goes\b|\bAG\b/],
  ['ubers', /\bubers?\b/i],
  ['nfe', /\bNFE\b/i],
  ['zu', /\bZU\b/i],
  ['lc', /\bLC\b|\blittle\s*cup\b/i],
  ['pu', /\bPU\b/i],
  ['nu', /\bNU\b/i],
  ['ru', /\bRU\b/i],
  ['uu', /\bUU\b/i],
  ['ou', /\bOU\b/i],
];

/**
 * @param {string} text Free text naming a tier (thread or subforum title).
 * @return {?string} The tier segment of a format id ("ou", "doublesuu"),
 *     or null when no tier is named.
 */
export function tierFromTitle(text) {
  for (const [tier, pattern] of TIER_PATTERNS) {
    if (pattern.test(text || '')) return tier;
  }
  return null;
}

// Generation words as titles and dump headings use them ("ADV", "DPP
// Ubers", "USM OU"). Most-specific first: "USUM" before "SM", "B2W2"
// before "BW".
const GEN_PATTERNS = [
  [9, /\bSV\b/],
  [8, /\bSS\b|\bSwSh\b/i],
  [7, /\bUSU?M\b|\bSM\b/i],
  [6, /\bORAS\b|\bXY\b/i],
  [5, /\bB2W2\b|\bBW2?\b/i],
  [4, /\bDPP?\b|\bHGSS\b/i],
  [3, /\bADV\b|\bRSE\b/i],
  [2, /\bGSC\b/i],
  [1, /\bRBY\b/i],
];
const GEN_WORD =
  /\b(RBY|GSC|ADV|RSE|DPP?|HGSS|B2W2|BW2?|ORAS|XY|USU?M|SM|SwSh|SS|SV)\b/gi;

/**
 * @param {string} text Free text naming a generation by its games.
 * @return {?number} The generation, or null when none is named.
 */
export function genFromLabel(text) {
  for (const [gen, pattern] of GEN_PATTERNS) {
    if (pattern.test(text || '')) return gen;
  }
  return null;
}

/**
 * Every generation label in a text, in order, with the tier named on the
 * same line right after it when there is one: the section headings a
 * tournament dump uses ("ADV", "DPP Ubers", "SM OU vs X").
 * @param {string} text
 * @return {!Array<{index: number, gen: number, tier: ?string}>}
 */
export function findLabels(text) {
  const source = String(text || '');
  const labels = [];
  for (const match of source.matchAll(GEN_WORD)) {
    const end = match.index + match[0].length;
    const line = source.slice(end, end + 24).split('\n')[0];
    labels.push({
      index: match.index,
      gen: genFromLabel(match[0]),
      tier: tierFromTitle(line),
    });
  }
  return labels;
}
