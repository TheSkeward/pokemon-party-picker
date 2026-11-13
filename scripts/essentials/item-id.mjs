/**
 * @fileoverview The catalog id of an item named by a game's files or a
 * guide to it.
 */

/**
 * @param {*} name An item's display name or symbol.
 * @return {string} Its lowercase alphanumeric id, as the held-item catalog
 *     writes it. The game's names carry accents the catalog's do not
 *     ("Poké Ball" is pokeball), so an accented letter folds to its base.
 */
export function itemId(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}
