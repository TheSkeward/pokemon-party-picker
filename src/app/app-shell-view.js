import { escapeHtml } from '../utils/html.js';
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
      return `<button class="view-tab ${state.family === family.id ? 'active' : ''}" data-app-family="${escapeHtml(family.id)}"${title}>${escapeHtml(label)}</button>`;
    })
    .join('\n        ');
  app.innerHTML = `
    <div class="app-shell">
      <header>
        <h1>Pokémon Party Picker</h1>
      </header>

      <nav class="view-tabs">
        ${familyTabs}
      </nav>

      <nav class="view-tabs secondary-tabs">
        <button class="view-tab ${state.view === 'resolver' ? 'active' : ''}" data-app-view="resolver">Set Lookup</button>
        <button class="view-tab ${state.view === 'pool' ? 'active' : ''}" data-app-view="pool">Team Builder</button>
        <button class="view-tab ${state.view === 'browser' ? 'active' : ''}" data-app-view="browser">Usage Data</button>
      </nav>

      <section id="page-root" class="page-stack"></section>
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
