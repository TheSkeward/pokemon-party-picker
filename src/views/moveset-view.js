import { escapeHtml, escapeAttr } from '../utils/html.js';
import {
  getMoveMeta,
  getTypeColor,
  getCategoryColor,
  describeMoveMeta,
  badgeStyle,
} from '../move-meta';
import { describeNature } from '../natures.js';
import { computeFinalStats, parseSpread } from '../teamBuilder/damage-model.js';
import { toId } from '../utils/ids.js';
import { STAT_LABELS } from '../utils/stats.js';

const HIDDEN_MOVESET_ENTRY_KEYS = new Set(['other', 'nothing']);

/**
 * Moveset detail panel; also binds move hover-highlight and click-to-filter
 * interactions on the rendered rows. Renders empty, loading, and no-data
 * states from selectedPokemonName/movesetEntry/status. "Other" and "Nothing"
 * entries are dropped from every list.
 * @param {!Element} container
 * @param {{selectedPokemonName: ?string, movesetEntry: ?Object,
 *     lookupLabel: string, sourceUsageLabel: (string|undefined),
 *     aggregate: boolean, stitched: boolean,
 *     status: ?{phase: string}}=} options
 */
export function renderMovesetPanel(container, options = {}) {
  const {
    selectedPokemonName = null,
    movesetEntry = null,
    lookupLabel = '',
    sourceUsageLabel = '',
    aggregate = false,
    stitched = false,
    status = null,
  } = options;

  if (!selectedPokemonName) {
    container.innerHTML = `
      <section class="panel details-panel empty-details">
        <h2>Movesets</h2>
        <p>Select a Pokémon to inspect its common moves, items, abilities, and spreads.</p>
      </section>
    `;
    return;
  }

  if (!movesetEntry && !status) {
    container.innerHTML = `
      <section class="panel details-panel empty-details">
        <h2>${escapeHtml(selectedPokemonName)}</h2>
        <p>No moveset data found for ${escapeHtml(lookupLabel || 'the current source')}.</p>
      </section>
    `;
    return;
  }

  const moves = cleanEntries(movesetEntry?.moves || []);
  const items = cleanEntries(movesetEntry?.items || []);
  const abilities = cleanEntries(movesetEntry?.abilities || []);
  const spreads = cleanEntries(movesetEntry?.spreads || []);
  const topSpreads = spreads.slice(0, 3);
  const pokemonId = toId(selectedPokemonName);

  // How the figures were made: true of every Pokémon, so folded away to
  // leave the first screen to this one's data.
  const methodNotes = [];

  if (aggregate)
    methodNotes.push(
      "Aggregated across all available months, weighted by each month's sample size.",
    );
  if (stitched)
    methodNotes.push(
      "Fallback-tier set options (shallower tiers first, from the family's strongest tier down) are appended with source tags instead of misleading percentages.",
    );

  methodNotes.push('Other and Nothing are hidden.');

  container.innerHTML = `
    <section class="panel details-panel wide-details">
      <div class="panel-header">
        <div>
          <h2>${escapeHtml(selectedPokemonName)}</h2>
          ${renderStatusLine(status)}
          <p>Movesets from ${escapeHtml(lookupLabel || 'the current source')}${
            sourceUsageLabel ? ` · ${escapeHtml(sourceUsageLabel)}` : ''
          }</p>
          <details class="moveset-method">
            <summary>How these numbers are made</summary>
            ${methodNotes.map((note) => `<p>${escapeHtml(note)}</p>`).join('')}
          </details>
          <p>Hover a move to highlight matches. Click a move to show only moves with the same type and category.</p>
        </div>
      </div>

      ${
        !movesetEntry
          ? '<p class="muted">Loading movesets...</p>'
          : `
            <div class="moveset-summary-grid">
              <section class="summary-card">
                <h3>Abilities</h3>
                ${renderCompactList(abilities, 'Abilities')}
              </section>
              <section class="summary-card">
                <h3>Top spreads</h3>
                ${renderCompactList(topSpreads, 'Spreads', pokemonId)}
              </section>
            </div>

            <div class="moveset-main-grid">
              ${renderSection('Moves', moves)}
              ${renderSection('Items', items)}
            </div>

            <details class="spreads-details">
              <summary>Show full spread list (${spreads.length})</summary>
              ${renderSection('Spreads', spreads, true, pokemonId)}
            </details>
          `
      }
    </section>
  `;

  bindMoveInteractions(container);
}

function renderStatusLine(status) {
  if (!status) return '';

  let label = '';
  const tone = status.phase;

  if (status.phase === 'loading') {
    label =
      status.total > 0
        ? `Loading set details… ${status.checked}/${status.total}`
        : 'Loading set details…';
  } else if (status.phase === 'ready') {
    label =
      status.contributed > 1
        ? `Complete · ${status.contributed} sources contributed`
        : 'Complete';
  } else if (status.phase === 'empty') {
    label = 'No moveset data found';
  }

  return `<div class="moveset-status-line"><span class="status-pill ${tone}">${escapeHtml(label)}</span></div>`;
}

function renderCompactList(entries = [], sectionTitle = '', pokemonId = '') {
  if (entries.length === 0) return '<p class="muted">No data.</p>';

  return `
    <ul class="compact-list">
      ${entries
        .map((entry, index) => {
          const tip =
            sectionTitle === 'Spreads' ? spreadTooltip(entry.name, pokemonId) : '';
          return `
            <li class="${isAdditionalEntry(entry) ? 'tail-entry' : ''}"${tip ? ` title="${escapeAttr(tip)}"` : ''}>
              <span class="entry-left">
                <span class="entry-rank">${index + 1}.</span>
                <span>${renderPlainEntryName(entry.name, sectionTitle)}</span>
              </span>
              ${renderEntryValue(entry)}
            </li>
          `;
        })
        .join('')}
    </ul>
  `;
}

function renderSection(title, entries = [], alreadyExpanded = false, pokemonId = '') {
  if (entries.length === 0) {
    return `
      <section class="moveset-section">
        <h3>${title}</h3>
        <p class="muted">No data.</p>
      </section>
    `;
  }

  let additionalStarted = false;
  let legalUnusedStarted = false;
  const rows = [];
  const sharedSources = sharedSourceRuns(entries);

  for (const [index, entry] of entries.entries()) {
    const moveMeta = title === 'Moves' ? resolveMoveMeta(entry) : null;
    const moveAttrs = moveMeta
      ? `data-move-type="${escapeAttr(moveMeta.type)}" data-move-category="${escapeAttr(moveMeta.category)}"`
      : '';
    const shared = sharedSources[index];
    // A run's source heads it, joined to the divider when the run opens
    // the additional options.
    const sourceHeading = shared?.opens
      ? escapeHtml(compactSourceText(shared.source))
      : '';

    if (isAdditionalEntry(entry) && !additionalStarted) {
      additionalStarted = true;
      rows.push(`<li class="section-divider">Additional set options${sourceHeading ? ` · ${sourceHeading}` : ''}</li>`);
    } else if (sourceHeading) {
      rows.push(`<li class="section-divider">${sourceHeading}</li>`);
    }

    if (isLegalUnusedEntry(entry) && !legalUnusedStarted) {
      legalUnusedStarted = true;
      rows.push(
        '<li class="section-divider">Other legal moves (no recorded usage)</li>',
      );
    }

    rows.push(
      title === 'Moves'
        ? renderMoveRow(entry, index, moveMeta, moveAttrs, Boolean(shared))
        : renderStandardRow(entry, index, title, pokemonId, Boolean(shared)),
    );
  }

  const movesFilterBar =
    title === 'Moves'
      ? `
        <div class="moves-filter-bar">
          <span class="moves-filter-status">Showing all moves</span>
          <button type="button" class="moves-filter-clear hidden">Clear filter</button>
        </div>
      `
      : '';

  return `
    <section class="moveset-section ${alreadyExpanded ? 'spreads-section' : ''}" data-section="${escapeAttr(title)}">
      <div class="moveset-section-header">
        <h3>${title}</h3>
        ${movesFilterBar}
      </div>
      <ul>${rows.join('')}</ul>
    </section>
  `;
}

// For each entry, the source it shares with its neighbours when two or
// more additional options in a row give the same one in place of a usage
// figure, and whether it opens that run; null otherwise. Such a run says
// its source once, over the rows, not on each.
function sharedSourceRuns(entries) {
  const sourceOf = (entry) =>
    (isAdditionalEntry(entry) && typeof entry.usage !== 'number'
      ? entry.sourceText || ''
      : '');
  const marks = new Array(entries.length).fill(null);
  let start = 0;
  while (start < entries.length) {
    const source = sourceOf(entries[start]);
    let end = start + 1;
    while (
      source && end < entries.length && sourceOf(entries[end]) === source
    ) {
      end += 1;
    }
    if (source && end - start >= 2) {
      for (let at = start; at < end; at++) {
        marks[at] = { source, opens: at === start };
      }
    }
    start = end;
  }
  return marks;
}

function renderMoveRow(
  entry, index, moveMeta, moveAttrs, sourceShared = false) {
  const facts = describeMoveMeta(moveMeta);
  return `
    <li class="moveset-row move-row ${isTailEntry(entry) ? 'tail-entry' : ''} ${moveMeta ? 'move-entry' : ''}" ${moveAttrs}>
      <span class="move-row-main">
        <span class="move-row-name" title="${escapeAttr(facts ? `${entry.name} — ${facts}` : entry.name)}">
          <span class="entry-rank">${index + 1}.</span>
          <span class="entry-name-text">${escapeHtml(entry.name)}</span>
        </span>
        <span class="move-row-types">
          ${
            moveMeta
              ? `
                <span class="move-badge" style="${badgeStyle(getTypeColor(moveMeta.type))}">${escapeHtml(moveMeta.type)}</span>
                <span class="move-badge" style="${badgeStyle(getCategoryColor(moveMeta.category))}">${escapeHtml(moveMeta.category)}</span>
              `
              : '<span class="entry-meta">—</span>'
          }
        </span>
        ${typeof entry.usage === 'number' ? `<strong>${entry.usage.toFixed(1)}%</strong>` : ''}
      </span>
      ${typeof entry.usage === 'number' || sourceShared ? '' : renderSourceLine(entry)}
    </li>
  `;
}

function renderStandardRow(
  entry, index, sectionTitle, pokemonId = '', sourceShared = false) {
  const tip = sectionTitle === 'Spreads' ? spreadTooltip(entry.name, pokemonId) : '';
  return `
    <li class="moveset-row ${isTailEntry(entry) ? 'tail-entry' : ''}"${tip ? ` title="${escapeAttr(tip)}"` : ''}>
      <span class="entry-left">
        <span class="entry-rank">${index + 1}.</span>
        <span>${renderPlainEntryName(entry.name, sectionTitle)}</span>
      </span>
      ${sourceShared ? '' : renderEntryValue(entry)}
    </li>
  `;
}

// Level 100 / 31 IVs is how Smogon spreads are defined.
function spreadTooltip(spreadName, pokemonId) {
  const parsed = parseSpread(spreadName);
  if (!parsed || !pokemonId) return '';
  const lines = [describeNature(parsed.natureLabel)].filter(Boolean);
  const stats = computeFinalStats({
    pokemonId,
    level: 100,
    nature: parsed.nature,
    evs: parsed.evs,
  });
  if (stats) {
    lines.push(
      `At Lv 100 (31 IVs): HP ${stats.hp} · Atk ${stats.atk} · Def ${stats.def} · SpA ${stats.spa} · SpD ${stats.spd} · Spe ${stats.spe}`,
    );
  }
  return lines.join('\n');
}

function renderEntryValue(entry) {
  if (typeof entry.usage === 'number') {
    return `<strong>${entry.usage.toFixed(1)}%</strong>`;
  }

  return renderSourceLine(entry);
}

function renderSourceLine(entry) {
  const full = entry.sourceText || '';
  const compact = compactSourceText(full);

  return `
    <span class="entry-meta source-meta" title="${escapeAttr(full)}">
      ${escapeHtml(compact)}
    </span>
  `;
}

function compactSourceText(value) {
  return String(value || '')
    .replace(/\s+—\s+/g, ' · ')
    .replace(/\s+\((\d+)\/(\d+) mo\)/g, ' $1/$2 mo')
    .replace('alternate Mega form', 'alt Mega')
    .replace('pre-evolution', 'pre-evo')
    .replace('base form', 'base');
}

function isAdditionalEntry(entry) {
  return entry.kind === 'fallback' || entry.kind === 'additional';
}

function isLegalUnusedEntry(entry) {
  return entry.kind === 'legal-unused';
}

function isTailEntry(entry) {
  return isAdditionalEntry(entry) || isLegalUnusedEntry(entry);
}

// Legal-move entries always carry their own type/category, so the badges
// still render for moves missing from the generated move table.
function resolveMoveMeta(entry) {
  return (
    getMoveMeta(entry.name) ||
    (entry.type
      ? { name: entry.name, type: entry.type, category: entry.category || 'Status' }
      : null)
  );
}

function renderPlainEntryName(name, sectionTitle) {
  return escapeHtml(formatEntryName(name, sectionTitle));
}

function formatEntryName(name, sectionTitle) {
  return sectionTitle === 'Spreads' ? prettyPrintSpread(name) : name;
}

function prettyPrintSpread(value) {
  const parsed = parseSpread(value);
  if (!parsed || parsed.evs.length !== 6) return value;

  const rendered = parsed.evs
    .map((amount, index) =>
      amount > 0 ? `${amount} ${STAT_LABELS[index]}` : null,
    )
    .filter(Boolean);

  return rendered.length > 0
    ? `${parsed.natureLabel} — ${rendered.join(' / ')}`
    : parsed.natureLabel;
}

function bindMoveInteractions(container) {
  const moveRows = [
    ...container.querySelectorAll(
      '.move-entry[data-move-type][data-move-category]',
    ),
  ];

  if (!moveRows.length) return;

  const statusNode = container.querySelector('.moves-filter-status');
  const clearButton = container.querySelector('.moves-filter-clear');
  let lockedFilter = null;

  const applyLockedFilter = () => {
    for (const row of moveRows) {
      row.classList.remove('move-filter-hidden');

      if (
        lockedFilter &&
        (row.dataset.moveType !== lockedFilter.type ||
          row.dataset.moveCategory !== lockedFilter.category)
      ) {
        row.classList.add('move-filter-hidden');
      }
    }

    if (statusNode) {
      statusNode.textContent = lockedFilter
        ? `Showing only ${lockedFilter.type} + ${lockedFilter.category}`
        : 'Showing all moves';
    }

    if (clearButton) clearButton.classList.toggle('hidden', !lockedFilter);
  };

  const clearHover = () => {
    for (const row of moveRows) {
      row.classList.remove('move-match-highlight', 'move-hover-source');
    }
  };

  const applyHover = (sourceRow) => {
    const { moveType, moveCategory } = sourceRow.dataset;

    clearHover();

    for (const row of moveRows) {
      if (
        row.dataset.moveType === moveType &&
        row.dataset.moveCategory === moveCategory &&
        !row.classList.contains('move-filter-hidden')
      ) {
        row.classList.add('move-match-highlight');
      }
    }

    sourceRow.classList.add('move-hover-source');
  };

  for (const row of moveRows) {
    row.addEventListener('mouseenter', () => applyHover(row));
    row.addEventListener('mouseleave', clearHover);

    row.addEventListener('click', () => {
      const nextFilter = {
        type: row.dataset.moveType,
        category: row.dataset.moveCategory,
      };

      lockedFilter =
        lockedFilter &&
        lockedFilter.type === nextFilter.type &&
        lockedFilter.category === nextFilter.category
          ? null
          : nextFilter;

      applyLockedFilter();

      if (!row.classList.contains('move-filter-hidden')) applyHover(row);
      else clearHover();
    });
  }

  clearButton?.addEventListener('click', () => {
    lockedFilter = null;
    applyLockedFilter();
    clearHover();
  });

  applyLockedFilter();
}

function cleanEntries(entries = []) {
  return entries.filter(
    (entry) => !HIDDEN_MOVESET_ENTRY_KEYS.has(normalizeKey(entry.name)),
  );
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}


