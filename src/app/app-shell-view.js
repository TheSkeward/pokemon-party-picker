import { currentAttr, escapeAttr, escapeHtml } from '../utils/html.js';
import { gameForFamily } from '../games/registry.js';

/**
 * The families grouped under the game each serves, in the order given. A
 * family no game claims stands alone under its own label.
 * @param {!Array<{id: string, label: string}>} families
 * @return {!Array<{label: string, title: string,
 *     families: !Array<{id: string, label: string}>}>}
 */
function familiesByGame(families) {
  const groups = new Map();
  for (const family of families) {
    const game = gameForFamily(family.id);
    const key = game ? game.id : family.id;
    if (!groups.has(key)) {
      groups.set(key, {
        label: game ? game.shortLabel : family.label,
        title: game ? game.label : '',
        families: [],
      });
    }
    groups.get(key).families.push(family);
  }
  return [...groups.values()];
}

// One choice of a segmented control: pressed when it is the one in force.
function segment(familyId, label, pressed, title = '') {
  return `<button type="button" aria-pressed="${pressed}" data-app-family="${escapeAttr(familyId)}"${title ? ` title="${escapeAttr(title)}"` : ''}>${escapeHtml(label)}</button>`;
}

/**
 * Replaces `app` contents with the shell chrome; pages mount into the empty
 * #page-root section it creates. The game and its format are a setting the
 * pages are read under, so they are two short rows of choices, shaped
 * apart from the page tabs: a game, then that game's usage-data families.
 * Choosing a game keeps the format's place in its list (Singles stays
 * Singles).
 * @param {!Element} app
 * @param {{family: string, view: string}} state
 * @param {!Array<{id: string, label: string}>} families
 */
export function renderAppShell(app, state, families) {
  const games = familiesByGame(families);
  const active =
    games.find((game) =>
      game.families.some((family) => family.id === state.family)) ||
    games[0];
  const place = active
    ? Math.max(
      0, active.families.findIndex((family) => family.id === state.family))
    : 0;
  const gameChoices = games
    .map((game) => {
      const family = game.families[Math.min(place, game.families.length - 1)];
      return segment(family.id, game.label, game === active, game.title);
    })
    .join('\n          ');
  const formatChoices = (active ? active.families : [])
    .map((family, index) => segment(family.id, family.label, index === place))
    .join('\n          ');
  const viewTab = (view, label) =>
    `<button class="view-tab ${state.view === view ? 'active' : ''}"${currentAttr(state.view === view)} data-app-view="${view}">${label}</button>`;
  app.innerHTML = `
    <div class="app-shell">
      <a class="skip-link" href="#page-root">Skip to content</a>
      <header>
        <h1>Pokémon Party Picker</h1>
      </header>

      <nav class="game-nav" aria-label="Game and format">
        <div class="segmented" role="group" aria-label="Game">
          ${gameChoices}
        </div>
        <div class="segmented" role="group" aria-label="Format">
          ${formatChoices}
        </div>
      </nav>

      <nav class="view-tabs secondary-tabs" aria-label="Pages">
        ${viewTab('resolver', 'Set Lookup')}
        ${viewTab('pool', 'Team Builder')}
        ${viewTab('browser', 'Usage Data')}
      </nav>

      <main id="page-root" class="page-stack" tabindex="-1"></main>
    </div>
  `;
}

/**
 * @param {!Element} app
 * @param {!Error} error
 */
export function renderFatalAppError(app, error) {
  app.innerHTML = `
    <div class="app-shell">
      <h1>Pokémon Party Picker</h1>
      <p>Something broke while loading the app.</p>
      <pre>${escapeHtml(error.message)}</pre>
    </div>
  `;
}
