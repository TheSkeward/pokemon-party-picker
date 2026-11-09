import { escapeHtml } from '../utils/html.js';

/**
 * Query toolbar for the Set Lookup page.
 * @param {!Element} container
 * @param {!Object} state
 */
export function renderResolverControls(container, state) {
  container.innerHTML = `
    <section class="panel">
      <div class="toolbar resolver-toolbar">
        <label class="wide-control"><span>Pokémon</span><input id="resolver-query-input" type="search" value="${escapeHtml(state.resolverQuery)}" placeholder="Charizard, Butterfree, Purrloin" /></label>
      </div>
    </section>`;
}
