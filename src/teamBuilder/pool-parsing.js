/**
 * @param {string} query
 * @param {Array<Object>} pokemonIndex
 * @return {Array<string>} Canonical Pokémon names, one per recognized pool
 *     token, duplicates preserved.
 */
export function parsePoolTokens(query, pokemonIndex) {
  return extractPoolNames(query, pokemonIndex);
}

/**
 * Ability annotations: a pool line like "Froakie (Torrent)" or
 * "Froakie [Torrent]" declares the CAUGHT mon's actual ability, replacing the
 * competitive-primary assumption for that line. The optimizer validates the
 * text against the line's real ability options and silently ignores anything
 * that doesn't match, so ordinary parenthetical noise in pasted lists can't
 * corrupt scoring.
 * @param {string} query
 * @param {Array<Object>} pokemonIndex
 * @return {Map<string, string>} Normalized pokemon name -> annotation text.
 */
export function parseAbilityAnnotations(query, pokemonIndex) {
  const annotations = new Map();
  for (const rawLine of String(query || '').split(/\n+/)) {
    for (const part of rawLine.split(',')) {
      const match =
        /^(.*?)\s*[([]\s*([A-Za-z][A-Za-z' -]{1,28})\s*[)\]]\s*$/.exec(
          part.trim(),
        );
      if (!match) continue;
      const name = findPokemonNameInText(match[1], pokemonIndex);
      if (!name) continue;
      annotations.set(normalizeName(name), match[2].trim());
    }
  }
  return annotations;
}

/**
 * @param {string} query
 * @param {Array<Object>} pokemonIndex
 * @return {{totalCount: number, uniqueCount: number, duplicateCount: number}}
 */
export function getPoolStats(query, pokemonIndex) {
  const tokens = parsePoolTokens(query, pokemonIndex);
  const unique = new Set(tokens.map(normalizeName).filter(Boolean));

  return {
    totalCount: tokens.length,
    uniqueCount: unique.size,
    duplicateCount: Math.max(0, tokens.length - unique.size),
  };
}

/**
 * Lock markers: a pool entry written as "Gothitelle!" (or "!Gothitelle") is
 * pinned into the team. The marker sits outside any ability annotation, so
 * "Gothitelle! (Shadow Tag)" carries both.
 * @param {string} query
 * @param {Array<Object>} pokemonIndex
 * @return {Set<string>} Normalized names of locked entries.
 */
export function parseLockedNames(query, pokemonIndex) {
  const locked = new Set();
  for (const entry of poolEntries(query, pokemonIndex).values()) {
    if (entry.locked) locked.add(normalizeName(entry.canonical));
  }
  return locked;
}

/**
 * Keep markers: a pool entry written as "Larvesta*" (or "*Larvesta") is one
 * the owner means to hold onto whatever the bench says of it. The optimizer
 * ignores the mark; the bench shows it, so the entry is never read as a cut.
 * @param {string} query
 * @param {Array<Object>} pokemonIndex
 * @return {Set<string>} Normalized names of kept entries.
 */
export function parseKeptNames(query, pokemonIndex) {
  const kept = new Set();
  for (const entry of poolEntries(query, pokemonIndex).values()) {
    if (entry.kept) kept.add(normalizeName(entry.canonical));
  }
  return kept;
}

/**
 * Met levels: a pool entry written as "Munna@14" arrived at level 14, so it
 * never had the level-1 moves the game's starting window at 14 leaves out;
 * a bare "Munna@" arrived too late to have any of them. Anything from level
 * 2 up is reachable by candying down, so the level decides nothing else.
 * First annotation of a name wins.
 * @param {string} query
 * @param {Array<Object>} pokemonIndex
 * @return {Map<string, (number|true)>} Normalized name -> level, or true
 *     for a bare mark.
 */
export function parseMetLevels(query, pokemonIndex) {
  const levels = new Map();
  for (const entry of poolEntries(query, pokemonIndex).values()) {
    if (entry.metLevel != null) {
      levels.set(normalizeName(entry.canonical), entry.metLevel);
    }
  }
  return levels;
}

/**
 * Rewrites the pool text in canonical form with one entry locked or
 * unlocked. Same output shape as normalizePoolText.
 * @param {string} query
 * @param {string} name Any spelling the pool resolver accepts.
 * @param {boolean} locked
 * @param {Array<Object>} pokemonIndex
 * @return {string}
 */
export function setPoolEntryLock(query, name, locked, pokemonIndex) {
  const entries = poolEntries(query, pokemonIndex);
  const canonical = findPokemonNameInText(name, pokemonIndex);
  const entry = canonical && entries.get(normalizeName(canonical));
  if (entry) entry.locked = locked;
  return formatPoolEntries(entries);
}

/**
 * @param {string} query
 * @param {Array<Object>} pokemonIndex
 * @return {string} Deduplicated canonical names, alphabetized and
 *     comma-joined, each keeping its lock and keep markers and ability
 *     annotation.
 *     Annotations must survive normalization: the widget normalizes the pool
 *     text before every optimize, so anything dropped here never reaches
 *     the optimizer.
 */
export function normalizePoolText(query, pokemonIndex) {
  return formatPoolEntries(poolEntries(query, pokemonIndex));
}

/**
 * @return {Map<string, {canonical: string, ability: ?string,
 *     locked: boolean, kept: boolean}>} Normalized name -> entry,
 *     deduplicated; a name locked, kept or annotated on any of its
 *     occurrences keeps that fact.
 */
function poolEntries(query, pokemonIndex) {
  const annotations = parseAbilityAnnotations(query, pokemonIndex);
  const entries = new Map();
  for (const rawLine of String(query || '').split(/\n+/)) {
    const parts = rawLine.includes(',') ? rawLine.split(',') : [rawLine];
    for (const part of parts) {
      const name = extractNameFromPoolToken(part, pokemonIndex);
      if (!name) continue;
      const canonical = findPokemonNameInText(name, pokemonIndex);
      if (!canonical) continue;
      const key = normalizeName(canonical);
      const entry = entries.get(key) || {
        canonical,
        ability: annotations.get(key) || null,
        locked: false,
        kept: false,
        metLevel: null,
      };
      if (hasLockMarker(part)) entry.locked = true;
      if (hasKeepMarker(part)) entry.kept = true;
      if (entry.metLevel == null) entry.metLevel = metLevelOf(part);
      entries.set(key, entry);
    }
  }
  return entries;
}

// "Munna@14": the level the mon arrived at, which decides which of its
// level-1 moves it ever had (legal-moves.js, receivedForm). A bare "Munna@"
// says only that it arrived too late to have them. The mark sits after the
// name with nothing but markers behind it, so "Gengar @ Life Orb" from a
// pasted Showdown set is a plain entry.
const MET_MARK = /@\s*(\d{1,3})?(?=[\s!*]*$)/;
// A met level's digits anywhere in a token, for name resolution: "Porygon@2"
// must not read as Porygon2.
const MET_DIGITS = /@\s*\d{1,3}(?!\d)/;

function stripAnnotation(token) {
  return String(token || '')
    .trim()
    .replace(/\s*[([][^)\]]*[)\]]\s*$/, '');
}

// The level for "@14", true for a bare "@", null when absent or out of range.
function metLevelOf(token) {
  const match = MET_MARK.exec(stripAnnotation(token));
  if (!match) return null;
  if (match[1] == null) return true;
  const level = Number(match[1]);
  return level >= 1 && level <= 100 ? level : null;
}

// The token without its trailing ability annotation or met mark, where the
// markers live.
function bareToken(token) {
  return stripAnnotation(token).replace(MET_MARK, ' ').trim();
}

// "Gengar!", "! Gengar", "Gengar!*": a bang among the leading or trailing
// marker characters.
function hasLockMarker(token) {
  const bare = bareToken(token);
  return /^[!*]*!\s*\S/.test(bare) || /\S\s*![!*]*$/.test(bare);
}

// "Larvesta*", "*Larvesta", "Larvesta!*": a star among the markers. The
// prefix form must touch the name, so a pasted "* Larvesta" bullet is a
// plain entry, not a keep.
function hasKeepMarker(token) {
  const bare = bareToken(token);
  return /^[!*]*\*\S/.test(bare) || /\S\s*\*[!*]*$/.test(bare);
}

function formatPoolEntries(entries) {
  return [...entries.values()]
    .map(
      ({ canonical, ability, locked, kept, metLevel }) =>
        canonical + (metLevel === true ? '@' : metLevel ? `@${metLevel}` : '') +
        (locked ? '!' : '') + (kept ? '*' : '') +
        (ability ? ` (${ability})` : ''),
    )
    .sort((a, b) => a.localeCompare(b))
    .join(', ');
}

function extractPoolNames(query, pokemonIndex) {
  const names = [];

  for (const rawLine of String(query || '').split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.includes(',')) {
      for (const part of line.split(',')) {
        const name = extractNameFromPoolToken(part, pokemonIndex);
        if (name) names.push(name);
      }
      continue;
    }

    const name = extractNameFromPoolToken(line, pokemonIndex);
    if (name) names.push(name);
  }

  return names;
}

function extractNameFromPoolToken(value, pokemonIndex) {
  const text = String(value || '').trim();
  if (!text) return '';

  const anywhere = findPokemonNameInText(text, pokemonIndex);
  if (anywhere) return anywhere;

  for (const cell of text.split('\t')) {
    const fromCell = findPokemonNameInText(cell, pokemonIndex);
    if (fromCell) return fromCell;
  }

  const beforeNumericColumns = text.split(/\s+(?=\d|--|#)/)[0]?.trim();
  if (beforeNumericColumns && beforeNumericColumns !== text) {
    const fromPrefix = findPokemonNameInText(
      beforeNumericColumns,
      pokemonIndex,
    );
    if (fromPrefix) return fromPrefix;
  }

  return '';
}

function findPokemonNameInText(value, pokemonIndex) {
  const text = String(value || '').replace(MET_DIGITS, ' ').trim();
  const key = normalizeName(text);
  if (!key) return null;

  const exact = pokemonIndex.find(
    (pokemon) => normalizeName(pokemon.name) === key,
  );
  if (exact) return exact.name;

  const matches = pokemonIndex
    .map((pokemon) => ({ pokemon, key: normalizeName(pokemon.name) }))
    .filter(({ key: pokemonKey }) => pokemonKey && key.includes(pokemonKey))
    .sort((a, b) => b.key.length - a.key.length);

  return matches[0]?.pokemon.name || null;
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * The pool text every move-transfer reader sees: the fielded pool plus the
 * donor box (Pokémon owned but never fielded, kept for egg moves, Sketch
 * partners and move transfers), one entry per line.
 * @param {string} query
 * @param {string=} donorQuery
 * @return {string}
 */
export function withDonors(query, donorQuery = '') {
  const donors = String(donorQuery || '').trim();
  return donors ? `${String(query || '')}\n${donors}` : String(query || '');
}

/**
 * The donor box after the pool's entries join it: every Pokémon named in the
 * pool, as a plain name (no lock or keep marker, no ability annotation),
 * merged with the donors already listed, deduplicated and alphabetized. The
 * widget calls this whenever the pool is committed, never when something
 * leaves the pool, so the donor box only grows: the box is everything the
 * player has listed, and the pool is its fieldable subset.
 * @param {string} donorQuery
 * @param {string} query
 * @param {Array<Object>} pokemonIndex
 * @return {string}
 */
export function absorbPoolIntoDonors(donorQuery, query, pokemonIndex) {
  const names = parsePoolTokens(query, pokemonIndex);
  if (!names.length) return String(donorQuery || '');
  return normalizePoolText(
    `${String(donorQuery || '')}\n${names.join(', ')}`,
    pokemonIndex,
  );
}
