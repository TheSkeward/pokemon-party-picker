/**
 * @fileoverview The active game's palette. A descriptor's `theme` names the
 * game's own colors (shell, text, state trio, four accents) and the native
 * scheme they belong to; this puts them on the document root as the tokens
 * the stylesheet keys on. Only the shared fills stay put across games. See
 * the token block in styles/main.css.
 */

/** Descriptor `theme.shell` fields and the tokens they set. */
const SHELL_TOKENS = Object.freeze({
  base: '--bg-base',
  surface: '--bg-surface',
  hairline: '--hairline',
  text: '--text',
  textMuted: '--text-muted',
  ink: '--fill-ink',
});

/** Descriptor `theme.states` fields and the tokens they set. */
const STATE_TOKENS = Object.freeze({
  ok: '--state-ok',
  warn: '--state-warn',
  blocked: '--state-blocked',
});

/**
 * Every root property a theme sets, in the stylesheet's order.
 * @param {!Object} theme A descriptor's `theme`.
 * @return {!Array<!Array<string>>} `[property, value]` pairs.
 */
export function themeProperties(theme) {
  return [
    ['color-scheme', theme.scheme],
    ...Object.entries(SHELL_TOKENS)
      .filter(([field]) => field !== 'ink')
      .map(([field, token]) => [token, theme.shell[field]]),
    ...Object.entries(STATE_TOKENS)
      .map(([field, token]) => [token, theme.states[field]]),
    ...theme.accents
      .map((accent, index) => [`--accent-${index + 1}`, accent.color]),
    [SHELL_TOKENS.ink, theme.shell.ink],
  ];
}

/**
 * @param {!Object} game A game descriptor with a `theme`.
 * @param {!Element=} root Where the tokens are set; the document root.
 */
export function applyGameTheme(game, root = document.documentElement) {
  for (const [property, value] of themeProperties(game.theme)) {
    root.style.setProperty(property, value);
  }
}
