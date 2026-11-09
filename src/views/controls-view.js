import { escapeHtml } from '../utils/html.js';

/**
 * Format/search toolbar for the Usage Data page.
 * @param {!Element} container
 * @param {!Object} state
 * @param {!Array<!Object>} formatsIndex
 */
export function renderControls(container, state, formatsIndex) {
  const familyFormats = formatsIndex.filter(
    (format) => format.family === state.family,
  );
  container.innerHTML = `
    <section class="panel">
      <div class="toolbar">
        <label><span>Format</span><select id="format-select">
          ${familyFormats.map((format) => `<option value="${format.id}" ${format.id === state.format ? 'selected' : ''}>${format.label}</option>`).join('')}
        </select></label>
        <label><span>Search</span><input id="search-input" type="search" value="${escapeHtml(state.search)}" placeholder="Charizard, Butterfree" /></label>
      </div>
    </section>`;
}
