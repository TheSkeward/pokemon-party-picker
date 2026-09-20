/**
 * @fileoverview The active game's look: its four accent hues (bench boxes,
 * move-source pills) go onto the document root as the `--accent-N` tokens
 * the stylesheet keys on. The shell palette is shared; only the accents
 * are a game's own. See the token block in styles/main.css.
 */

/**
 * @param {!Object} game A game descriptor with `theme.accents`.
 * @param {!Element=} root Where the tokens are set; the document root.
 */
export function applyGameTheme(game, root = document.documentElement) {
  (game.theme?.accents || []).forEach((accent, index) => {
    root.style.setProperty(`--accent-${index + 1}`, accent.color);
  });
}
