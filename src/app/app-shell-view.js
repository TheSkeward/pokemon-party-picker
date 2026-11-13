import { currentAttr, escapeHtml } from '../utils/html.js';
import { gameForFamily } from '../games/registry.js';

/**
 * Replaces `app` contents with the shell chrome; pages mount into the empty
 * #page-root section it creates. One tab per usage-data family, titled with
 * the game that family serves.
 * @param {!Element} app
 * @param {{family: string, view: string}} state
 * @param {!Array<{id: string, label: string}>} families
 */
export function renderAppShell(app, state, families) {
  // A tab names its game first: the family alone does not say which game's
  // rules the pages below apply.
  const familyTabs = families
    .map((family) => {
      const game = gameForFamily(family.id);
      const label = game
        ? `${game.shortLabel} · ${family.label}`
        : family.label;
      const title = game ? ` title="${escapeHtml(game.label)}"` : '';
      const current = state.family === family.id;
      return `<button class="view-tab ${current ? 'active' : ''}"${currentAttr(current)} data-app-family="${escapeHtml(family.id)}"${title}>${escapeHtml(label)}</button>`;
    })
    .join('\n        ');
  const viewTab = (view, label) =>
    `<button class="view-tab ${state.view === view ? 'active' : ''}"${currentAttr(state.view === view)} data-app-view="${view}">${label}</button>`;
  app.innerHTML = `
    <div class="app-shell">
      <a class="skip-link" href="#page-root">Skip to content</a>
      <header>
        <h1>Pokémon Party Picker</h1>
      </header>

      <nav class="view-tabs" aria-label="Game and format">
        ${familyTabs}
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
