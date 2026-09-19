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
 *     comma-joined, each keeping its lock marker and ability annotation.
 *     Annotations must survive normalization: the widget normalizes the pool
 *     text before every optimize, so anything dropped here never reaches
 *     the optimizer.
 */
export function normalizePoolText(query, pokemonIndex) {
  return formatPoolEntries(poolEntries(query, pokemonIndex));
}

/**
 * @return {Map<string, {canonical: string, ability: ?string,
 *     locked: boolean}>} Normalized name -> entry, deduplicated; a name
 *     locked or annotated on any of its occurrences keeps that fact.
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
      };
      if (hasLockMarker(part)) entry.locked = true;
      entries.set(key, entry);
    }
  }
  return entries;
}

function hasLockMarker(token) {
  const bare = String(token || '')
    .trim()
    .replace(/\s*[([][^)\]]*[)\]]\s*$/, '');
  return /^!\s*\S/.test(bare) || /\S\s*!$/.test(bare);
}

function formatPoolEntries(entries) {
  return [...entries.values()]
    .map(
      ({ canonical, ability, locked }) =>
        canonical + (locked ? '!' : '') + (ability ? ` (${ability})` : ''),
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
  const text = String(value || '').trim();
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
