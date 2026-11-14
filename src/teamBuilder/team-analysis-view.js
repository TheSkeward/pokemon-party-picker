import { escapeAttr, escapeHtml } from '../utils/html.js';
import {
  badgeStyle,
  getMoveMeta,
  getTypeColor,
  describeMoveMeta,
} from '../move-meta.js';
import { toId } from '../utils/ids.js';
import { describeNature } from '../natures.js';
import { computeFinalStats } from './damage-model.js';
import { formatAbilityPath } from './ability-path.js';
import { describeEvolutionPath } from '../playthrough/evolution-requirements.js';
import {
  buildTeamAnalysis,
  formatEvLine,
  formatTeamPokepaste,
  analysisTypes,
} from './team-analysis.js';
import { STAT_KEYS } from '../utils/stats.js';
import { getActiveGame } from '../games/registry.js';
import { trackReads } from '../utils/track-reads.js';

// The page re-renders several times per optimize (result render, analysis-
// pending render, confidence render, investment render) with IDENTICAL panel
// inputs, and the underlying analysis (per-member legal-move entries, damage
// tables, bench swaps) is the most expensive thing on the page — so memo the
// build by input signature and re-paint from it. This also stops the panel
// flashing back to its "Checking..." placeholder on every re-render. The
// order the picks are shown in is not an input: the analysis is built for
// the picks in signature order, so re-sorting the team table repaints the
// cards from the memo instead of rebuilding it. Of the owned items the
// build reads only a few (a set's item, an evolution's, a field
// extender's), so they are left out of the key and the memo records which
// ones it read: an edit to any other item keeps it.
let analysisMemo = { key: null, promise: null };

// Whether the memo answers for these inputs: the same key, and owned items
// that differ only where the build never looked. A build still running has
// not finished looking.
function memoHolds(key, ownedItems) {
  if (analysisMemo.key !== key) return false;
  if (analysisMemo.ownedItems === ownedItems) return true;
  return analysisMemo.settled && analysisMemo.itemReads.agreesWith(ownedItems);
}

/**
 * What the analysis reads of one pick. A progression edit first renders the
 * old build under the new rules, and re-optimization can keep the
 * species/build key but replace its moves; the completed set must not reuse
 * that interim, incomplete analysis, so the moves are part of it.
 * @param {!Object} member
 * @return {string}
 */
function memberSignature(member) {
  return JSON.stringify([
    member.pokemonId,
    member.inputPokemonId || '',
    member.buildKey || '',
    member.legalityProfile?.assumedAbility || '',
    member.legalityProfile?.targetAbility || '',
    member.legalityProfile?.preMegaAbility || '',
    member.legalityProfile?.inputAbility || '',
    Boolean(member.legalityProfile?.abilityKnown),
    (member.legalityProfile?.recommendedMoves || []).map((move) => move.id),
  ]);
}

/**
 * Renders the team-analysis panel into `root` (cleared for an empty team),
 * memoizing the underlying analysis by input signature. The set cards follow
 * the order of `team`.
 * @param {?Element} root
 */
export function renderTeamAnalysisPanel(root, {
  family,
  itemAssignments,
  lines = [],
  pokemonIndex = [],
  poolQuery = '',
  progression,
  team,
}) {
  if (!root) return;

  if (!team?.length) {
    root.innerHTML = '';
    return;
  }

  // The caller's order only places the cards.
  const signed = team
    .map((member) => ({ member, signature: memberSignature(member) }))
    .sort((a, b) =>
      a.signature < b.signature ? -1 : a.signature > b.signature ? 1 : 0);
  const analysed = signed.map((entry) => entry.member);
  const cardOrder = team.map((member) => analysed.indexOf(member));

  const { ownedItems = {}, ...rules } = progression || {};
  const memoKey = JSON.stringify([
    signed.map((entry) => entry.signature),
    itemAssignments || null,
    rules,
    family || '',
    poolQuery,
    // The bench fix suggestions read the pool lines; a render without them
    // (a progression edit's quick refresh) must not settle for one with.
    lines.map((line) => (line.best || line.bestNonMega)?.inputPokemonId || ''),
  ]);

  if (!memoHolds(memoKey, ownedItems)) {
    const itemReads = trackReads(ownedItems);
    const memo = {
      key: memoKey,
      ownedItems,
      itemReads,
      settled: false,
      promise: buildTeamAnalysis(analysed, {
        ...progression,
        ownedItems: itemReads.record,
      }, {
        family,
        itemAssignments,
        lines,
        pokemonIndex,
        query: poolQuery,
      })
        .catch((error) => {
          console.error('Failed to build Reborn team analysis', error);
          return null;
        })
        .then((analysis) => {
          memo.settled = true;
          return analysis;
        }),
    };
    analysisMemo = memo;
  }
  if (!analysisMemo.settled) {
    root.innerHTML = `
      <section class="panel reborn-team-analysis-panel">
        <div class="panel-header">
          <div>
            <h2>Sets &amp; coverage</h2>
            <p class="muted">Checking defensive profile and legal attacking coverage...</p>
          </div>
        </div>
      </section>
    `;
  }

  // Returned so callers can sequence heavy background work (the confidence
  // sweep) AFTER the movesets are actually on screen. Resolves on failure too —
  // it signals "the panel is settled", not "the analysis succeeded".
  const memo = analysisMemo;
  return memo.promise.then((analysis) => {
    // Superseded: the root is gone, or a newer analysis with another key
    // started on the same root and must be the one that paints last.
    if (!root.isConnected || analysisMemo !== memo) return;
    if (analysis) {
      const shown = {
        ...analysis,
        profiles: cardOrder.map((index) => analysis.profiles[index]),
      };
      root.innerHTML = renderAnalysis(shown);
      wirePokepasteCopy(root, shown);
    } else {
      root.innerHTML = `
        <section class="panel reborn-team-analysis-panel">
          <h2>Sets &amp; coverage</h2>
          <p class="muted">Team analysis could not be loaded.</p>
        </section>
      `;
    }
  });
}

function wirePokepasteCopy(root, analysis) {
  wireCopyButtons(
    root.querySelectorAll('[data-copy-pokepaste]'),
    formatTeamPokepaste(
      analysis.profiles.map((profile) => profile.recommendedSet),
    ),
    'Copy team as poképaste',
  );
  const displayedRealTeam =
    analysis.fieldableRealTeam || analysis.closestRealTeam?.team;
  if (displayedRealTeam) {
    wireCopyButtons(
      root.querySelectorAll('[data-copy-real-pokepaste]'),
      formatTeamPokepaste(realTeamPokepasteSets(displayedRealTeam)),
      'Copy as poképaste',
    );
  }
}

function wireCopyButtons(buttons, pokepaste, idleLabel) {
  for (const button of buttons) {
    if (button.dataset.pokepasteWired) continue;
    button.dataset.pokepasteWired = '1';
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pokepaste);
        button.textContent = 'Copied!';
      } catch {
        button.textContent = 'Copy failed';
      }
      setTimeout(() => {
        button.textContent = idleLabel;
      }, 2000);
    });
  }
}

function renderAnalysis(analysis) {
  const sharedWeaknesses = analysis.defensive
    .filter((entry) => entry.weak.length >= 2)
    .sort(
      (a, b) =>
        b.weak.length - a.weak.length ||
        getCoverCount(a) - getCoverCount(b) ||
        a.type.localeCompare(b.type),
    );

  const uncoveredWeaknesses = sharedWeaknesses.filter(
    (entry) => entry.resist.length + entry.immune.length === 0,
  );

  const sturdySwitchTypes = analysis.defensive
    .filter((entry) => entry.resist.length + entry.immune.length >= 2)
    .sort(
      (a, b) =>
        getCoverCount(b) - getCoverCount(a) ||
        a.weak.length - b.weak.length ||
        a.type.localeCompare(b.type),
    );

  return `
    <section class="panel reborn-team-analysis-panel">
      <div class="panel-header team-analysis-header">
        <div>
          <h2>Sets &amp; coverage</h2>
          <p>${analysis.members.length} picks at the current ${getActiveGame().shortLabel} progression. Damage shown is naive unresisted output at your level cap.</p>
        </div>
        <button type="button" class="view-tab" data-copy-pokepaste>Copy team as poképaste</button>
      </div>

      <div class="team-analysis-grid">
        ${renderSummaryCard({
          // Counted without a verdict: a shared weakness a teammate covers
          // is ordinary, and the next tile says whether one is not.
          label: 'Shared Weaknesses',
          value: sharedWeaknesses.length,
          detail: sharedWeaknesses.length
            ? listSome(sharedWeaknesses.map((entry) => entry.type), 3)
            : 'No type hits 2+ picks super effectively.',
        })}
        ${renderSummaryCard({
          label: 'Weaknesses with no switch-in',
          value: uncoveredWeaknesses.length,
          tone: uncoveredWeaknesses.length ? 'warn' : 'ok',
          detail: uncoveredWeaknesses.length
            ? listSome(uncoveredWeaknesses.map((entry) => entry.type), 3)
            : 'Every shared weakness has a resist or immunity.',
        })}
        ${renderSummaryCard({
          label: 'Picks with a STAB attack',
          value: `${analysis.members.length - analysis.offensive.missingStabMembers.length}/${analysis.members.length}`,
          tone: analysis.offensive.missingStabMembers.length ? 'warn' : 'ok',
          detail: analysis.offensive.missingStabMembers.length
            ? `No STAB yet: ${listSome(
              analysis.offensive.missingStabMembers
                .map((entry) => entry.member.name),
              3,
            )}.`
            : 'Every pick has a recommended damaging STAB move.',
        })}
        ${renderSummaryCard({
          label: 'Types with no SE answer',
          value: analysis.offensive.missingSuperEffectiveTargets.length,
          tone: analysis.offensive.missingSuperEffectiveTargets.length
            ? 'warn'
            : 'ok',
          detail: analysis.offensive.missingSuperEffectiveTargets.length
            ? listSome(analysis.offensive.missingSuperEffectiveTargets, 4)
            : 'The team can hit every type super effectively.',
        })}
      </div>

      <h3>Recommended Sets</h3>
      ${renderSetCards(analysis.profiles)}

      ${renderExplanation(analysis.explanation)}

      <div class="team-analysis-columns">
        <div>
          <h3>Defensive Profile</h3>
          ${renderDefensiveRows(sharedWeaknesses, sturdySwitchTypes)}
        </div>
        <div>
          <h3>Team Coverage</h3>
          ${renderCoverageSummary(analysis.offensive)}
        </div>
      </div>

      ${renderRealTeamPanel({
        fieldableTeam: analysis.fieldableRealTeam,
        closestMatch: analysis.closestRealTeam,
        dataAvailable: analysis.realTeamDataAvailable,
      })}
    </section>
  `;
}

/**
 * Shows the most-seen fully fieldable scraped team. If none qualifies, the
 * closest distinct-species match remains visible with an explicit receipt
 * for missing Pokémon, progression-locked moves, and tracked held items.
 * @param {{fieldableTeam: (?Object|undefined),
 *     closestMatch: (?Object|undefined),
 *     dataAvailable: (boolean|undefined)}=} options
 * @return {string} The panel's HTML.
 */
export function renderRealTeamPanel({
  fieldableTeam = null,
  closestMatch = null,
  dataAvailable = false,
} = {}) {
  const team = fieldableTeam || closestMatch?.team;
  // A family with no scraped teams has nothing to say here.
  if (!team && !dataAvailable) return '';
  if (!team) {
    return `
      <div class="team-real-team team-real-team-empty">
        <h3>Real-team match</h3>
        <p class="muted">${dataAvailable
          ? 'No valid scraped teams are available to compare.'
          : 'No scraped real-team data is available for this format family.'}</p>
      </div>
    `;
  }

  const provenance = [
    team.formatId,
    dominantSourceKind(team.sources),
    team.count ? `seen ${team.count}×` : null,
  ].filter(Boolean);

  return `
    <div class="team-real-team">
      <div class="team-analysis-header">
        <div>
          <h3>${fieldableTeam ? 'Fieldable real team' : 'Closest real team'}</h3>
          <p class="muted">${escapeHtml(provenance.join(' · '))}</p>
        </div>
        <button type="button" class="view-tab" data-copy-real-pokepaste>Copy as poképaste</button>
      </div>
      ${closestMatch ? renderClosestRealTeamReceipt(closestMatch) : ''}
      <div class="team-set-cards">
        ${(team.members || [])
          .map((member, index) =>
            renderRealTeamMember(member, closestMatch?.members?.[index]),
          )
          .join('')}
      </div>
    </div>
  `;
}

function renderClosestRealTeamReceipt(match) {
  const missingSpecies = (match.team?.members || []).filter(
    (member, index) => !match.members?.[index]?.speciesAvailable,
  );
  const missingMoves = (match.team?.members || []).flatMap((member, index) =>
    (match.members?.[index]?.missingMoves || []).map(
      (move) => `${member.species}: ${move.name}`,
    ),
  );
  const gaps = [
    missingSpecies.length
      ? `<li><strong>Missing Pokémon:</strong> ${escapeHtml(
        missingSpecies.map((member) => member.species).join(', '),
      )}</li>`
      : null,
    missingMoves.length
      ? `<li><strong>Moves unavailable now:</strong> ${escapeHtml(
        missingMoves.join(', '),
      )}</li>`
      : null,
    match.missingItems?.length
      ? `<li><strong>Held items still needed:</strong> ${escapeHtml(
        match.missingItems.map(formatItemShortage).join(', '),
      )}</li>`
      : null,
  ].filter(Boolean);

  return `
    <div class="team-real-team-receipt">
      <p>
        No indexed team is fully fieldable yet. Your pool can field
        <strong>${match.matchedCount}/${match.memberCount} Pokémon</strong>
        from this one; popularity breaks equally close ties.
      </p>
      ${gaps.length ? `<ul>${gaps.join('')}</ul>` : ''}
    </div>
  `;
}

function formatItemShortage(shortage) {
  const count = shortage.needed > 1 ? ` ×${shortage.needed}` : '';
  return `${shortage.item}${count} (own ${shortage.owned})`;
}

function dominantSourceKind(sources = {}) {
  const best = Object.entries(sources || {}).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0];
  return best ? `${best[0]} team` : null;
}

function renderRealTeamMember(member, availability = null) {
  const natureTip = member.nature ? describeNature(member.nature) : '';
  const metaParts = [
    escapeHtml(member.item || 'No item'),
    member.ability ? escapeHtml(member.ability) : null,
    member.level ? escapeHtml(`Lv ${member.level}`) : null,
    member.nature
      ? `<span${natureTip ? ` title="${escapeHtml(natureTip)}"` : ''}>${escapeHtml(`${member.nature} nature`)}</span>`
      : null,
  ].filter(Boolean);
  const evs = formatEvs(evsToArray(member.evs));
  const missingMoves = availability?.missingMoves || [];
  const missingMoveIndexes = new Set(missingMoves.map((move) => move.index));
  const warning =
    availability &&
    (!availability.speciesAvailable || missingMoves.length > 0);
  const status = !availability
    ? null
    : !availability.speciesAvailable
      ? 'Missing Pokémon'
      : missingMoves.length
        ? `Unavailable ${missingMoves.length === 1 ? 'move' : 'moves'}: ${missingMoves.map((move) => move.name).join(', ')}`
        : 'Pokémon and moves ready';

  return `
    <div class="team-set-card${warning ? ' warning' : ''}">
      <div class="team-set-head">
        <h4>${escapeHtml(member.species)}</h4>
        ${status ? `<small class="team-real-team-member-status">${escapeHtml(status)}</small>` : ''}
      </div>
      <div class="team-set-meta">${metaParts.join(' · ')}</div>
      ${evs ? `<div class="team-set-evs">${escapeHtml(evs)}</div>` : ''}
      <ul class="team-set-moves">
        ${(member.moves || [])
          .map((name, index) =>
            renderRealTeamMove(name, missingMoveIndexes.has(index)),
          )
          .join('')}
      </ul>
    </div>
  `;
}

function renderRealTeamMove(name, unavailable = false) {
  const meta = getMoveMeta(name);
  const facts = describeMoveMeta(meta);

  return `
    <li class="team-set-move${unavailable ? ' unavailable' : ''}">
      ${renderTypeBadge(meta?.type || 'Normal')}
      <span class="team-set-move-name"${facts ? ` title="${escapeHtml(facts)}"` : ''}>${escapeHtml(name)}</span>
    </li>
  `;
}

// Team-index members carry evs as a {hp,atk,...} object; the poképaste and
// EV-line formatters expect the HP→Spe array.
function evsToArray(evs) {
  if (!evs) return null;
  if (Array.isArray(evs)) return evs;
  return STAT_KEYS.map((stat) => evs[stat] || 0);
}

function realTeamPokepasteSets(team) {
  return (team?.members || []).map((member) => ({
    species: member.species,
    item: member.item || null,
    ability: member.ability || null,
    level: member.level || null,
    evs: evsToArray(member.evs),
    nature: member.nature || null,
    moves: member.moves || [],
  }));
}

function renderExplanation(explanation) {
  if (!explanation?.fixSuggestions?.length) return '';

  return `
    <section class="team-analysis-explanation">
      <div>
        <h3>Possible Fixes</h3>
        <ul class="team-analysis-explanation-list">
          ${explanation.fixSuggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>
    </section>
  `;
}

function renderSetCards(profiles = []) {
  if (!profiles.length) {
    return `<p class="muted">No recommended sets are available yet.</p>`;
  }

  return `
    <div class="team-set-cards">
      ${profiles.map(renderSetCard).join('')}
    </div>
  `;
}

function renderSetCard(profile) {
  const set = profile.recommendedSet || {};
  const eventual =
    profile.representativeName &&
    profile.representativeName !== profile.currentName
      ? profile.representativeName
      : null;
  const caught =
    Boolean(profile.inputName) && profile.inputName !== profile.currentName;
  // An evolved form shows only its own ability, so the catch that leads to
  // it is named here: a Surskit becomes an Intimidate Masquerain only when
  // caught with Swift Swim. Omitted once the pool pins the ability, and for
  // Megas, whose base ability is a separate, pre-Mega fact.
  const catchAbility =
    caught && !profile.abilityKnown && !profile.megaReady &&
    profile.inputAbility && set.ability &&
    toId(profile.inputAbility) !== toId(set.ability)
      ? `, ${profile.inputAbility}`
      : '';
  // "from Burmy@20 (Female, in buildings), Shed Skin": what the input mon
  // needs to become this form, and which of it to catch.
  const origin = caught
    ? `from ${profile.inputName}${describeEvolutionPath(
      toId(profile.inputName),
      profile.currentId,
    )}${catchAbility}`
    : null;
  const subParts = [
    origin,
    eventual ? `→ ${eventual} later` : null,
  ].filter(Boolean);
  const natureTip = set.nature ? describeNature(set.nature) : '';
  // An item the player cannot have yet says so where it is named: the
  // headline is otherwise read as what to equip today.
  const itemAhead = set.item && set.itemAheadBadge != null
    ? `<span class="team-set-ahead" title="${escapeAttr(`Not obtainable before ${badgeCount(set.itemAheadBadge)}`)}">${escapeHtml(`${set.item} (${badgeCount(set.itemAheadBadge)})`)}</span>`
    : null;
  const metaParts = [
    itemAhead || escapeHtml(set.item || 'No item recommended'),
    set.ability
      ? escapeHtml(formatAbilityPath(set.ability, set.targetAbility)) : null,
    set.level ? escapeHtml(`Lv ${set.level}`) : null,
    set.nature
      ? `<span${natureTip ? ` title="${escapeHtml(natureTip)}"` : ''}>${escapeHtml(`${set.nature} nature`)}</span>`
      : null,
  ].filter(Boolean);
  const evs = formatEvs(set.evs);
  const finalStats = evs
    ? computeFinalStats({
      pokemonId: profile.currentId,
      level: set.level || 100,
      nature: set.nature,
      evs: set.evs,
    })
    : null;
  const statsTip = finalStats
    ? `At Lv ${finalStats.level} (31 IVs): HP ${finalStats.hp} · Atk ${finalStats.atk} · Def ${finalStats.def} · SpA ${finalStats.spa} · SpD ${finalStats.spd} · Spe ${finalStats.spe}`
    : '';
  const moves =
    profile.recommendedMoves?.length ? profile.recommendedMoves : [];

  return `
    <div class="team-set-card ${profile.bestStabMove ? '' : 'warning'}" data-set-card="${escapeHtml(profile.fieldedId || profile.currentId || '')}">
      <div class="team-set-head">
        <span>
          <h4>${escapeHtml(profile.currentName)}</h4>
          ${renderBuildLabel(profile)}
        </span>
        ${subParts.length ? `<small>${escapeHtml(subParts.join(' · '))}</small>` : ''}
      </div>
      <div class="team-set-meta">${metaParts.join(' · ')}</div>
      ${evs ? `<div class="team-set-evs"${statsTip ? ` title="${escapeHtml(statsTip)}"` : ''}>${escapeHtml(evs)}</div>` : ''}
      ${renderSetMoves(moves, 'No legal damaging moves available yet.')}
      ${renderSetReadiness(profile.setReadiness, profile)}
      ${renderDonorInterimGuides(profile.donorInterimGuides)}
      <div class="team-set-foot">
        <small>${profile.superEffectiveTargetCount}/${analysisTypes().length} types hit super effectively</small>
      </div>
    </div>
  `;
}

// The locked moves of a set that are learned only before evolving, as
// "Recover held from Shellos to 46". The optimizer seats such a lock without
// charging the hold (resolveCandidateBuilds), so the card is where the
// player learns the set assumes it.
function lockedHoldNote(profile) {
  const holdOf = (move) => {
    const sources = move.availableSources || [];
    return move.locked && sources.length &&
        sources.every((source) => source.delayedEvolution)
      ? sources[0]
      : null;
  };
  const held = (profile.recommendedMoves || []).filter(holdOf);
  if (!held.length) return '';
  const names = held.map((move) => move.name).join(', ');
  const longest = held
    .map(holdOf)
    .sort((a, b) => (b.heldLevels || 0) - (a.heldLevels || 0))[0];
  return longest.learnerName && longest.level
    ? `${names} held from ${longest.learnerName} to ${longest.level}`
    : `${names} held from before evolving`;
}

// Names the build when it is not the standard set, with the canonical moves
// the set line calls ready that this build left out, so the card never
// contradicts the readiness line beneath it without saying why. A standard
// set is named only when a lock makes it hold an evolution.
function renderBuildLabel(profile) {
  const hold = lockedHoldNote(profile);
  if (!profile.buildKey || profile.buildKey === 'default') {
    if (!hold) return '';
    const title =
      'A locked move is learned only before evolving, so the set assumes ' +
      'the evolution was held for it.';
    return `<span class="team-set-build" title="${escapeHtml(title)}">${escapeHtml(`Standard set · ${hold}`)}</span>`;
  }
  const carried = new Set(
    (profile.recommendedMoves || []).map((move) => move.id),
  );
  const traded = (profile.setReadiness?.moves || [])
    .filter(
      (move) =>
        (move.status === 'ready' || move.status === 'scaling') &&
        !carried.has(move.id),
    )
    .map((move) => move.label);
  const label = profile.buildLabel || 'Alternative set';
  const title = traded.length
    ? `An alternative to the standard set, chosen for the team; it leaves out ${traded.join(' and ')}.`
    : 'An alternative to the standard set, chosen for the team; it keeps every canonical move available now.';
  const parts = [label];
  if (traded.length) parts.push(`without ${traded.join(', ')}`);
  if (hold) parts.push(hold);
  return `<span class="team-set-build" title="${escapeHtml(title)}">${escapeHtml(parts.join(' · '))}</span>`;
}

// One line of truth about the competitive set: how much of it exists yet and
// when it completes. Details per element live in the tooltip. An interim
// individual gets a second line: the final set is a re-bred one, so the
// spread above is that future hatch's and this mon is priced on its own
// best attacks.
function renderSetReadiness(readiness, profile = null) {
  if (!readiness) return '';
  const eggOnly = readiness.moves
    .filter((move) => move.eggOnly)
    .map((move) => move.label);
  const interim = readiness.needsRebreed
    ? `<div class="team-set-interim"><small>${escapeHtml(
      `Interim: the final set is a re-bred ${profile?.inputName || profile?.currentName || 'one'} hatched with ${eggOnly.join(' and ')}.`,
    )}</small></div>`
    : '';

  const parts = [];
  if (readiness.moves.length) {
    const displaced = readiness.moves.filter((move) => move.displaced).length;
    const seats = displaced
      ? ` (${displaced} seat${displaced === 1 ? '' : 's'} to locks)`
      : '';
    parts.push(
      `${readiness.readyMoveCount}/${readiness.moves.length} moves${seats}`,
    );
  }
  // Every lock, the ones inside the competitive set included.
  const locks = [
    ...readiness.moves.filter((move) => move.locked),
    ...(readiness.lockedMoves || []),
  ];
  if (locks.length) {
    const ready = locks.filter(
      (move) => move.status === 'ready' || move.status === 'scaling',
    ).length;
    parts.push(`${ready}/${locks.length} locked`);
  }
  if (readiness.item?.name) {
    if (readiness.item.status === 'ready') parts.push('item ✓');
    else if (readiness.item.status === 'later')
      parts.push(`item ${readiness.item.detail}`);
    else parts.push('item ?');
  }
  parts.push(
    readiness.pendingPickups
      ? 'pickups pending'
      : readiness.fullAtCap == null
        ? 'complete now'
        : `full at cap ${readiness.fullAtCap}`,
  );
  // A set still assembling is the ordinary state of a playthrough, so the
  // line is plain. Only what the player can act on today stands out:
  // something already obtainable that has not been picked up.
  const partsHtml = parts.map((part) => (part === 'pickups pending'
    ? `<span class="team-set-pending">${part}</span>`
    : escapeHtml(part)));

  // Listed as the builder seats them: the locks first, then the record's
  // moves, each saying why it is or is not in the set above.
  const entries = [...readiness.moves, ...(readiness.lockedMoves || [])];
  const ordered = [
    ...entries.filter((move) => move.locked),
    ...entries.filter((move) => !move.locked),
  ];
  const tooltip = [
    ...ordered.map((move) => {
      const mark =
        move.status === 'ready' ? '✓' : move.status === 'scaling' ? '↗' : '✗';
      const lock = move.locked ? ' (locked in the pool)' : '';
      const detail = [
        move.detail,
        move.displaced ? 'seat taken by a lock' : '',
        move.locked && move.status === 'later' ? 'seats once learnable' : '',
      ]
        .filter(Boolean)
        .join('; ');
      return `${mark} ${move.label}${lock}${detail ? ` — ${detail}` : ''}`;
    }),
    readiness.item?.name
      ? `${readiness.item.status === 'ready' ? '✓' : '✗'} ${readiness.item.name}${
        readiness.item.detail ? ` — ${readiness.item.detail}` : ''
      }`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `
    <div class="team-set-readiness" title="${escapeHtml(tooltip)}">
      <small>Competitive set: ${partsHtml.join(' · ')}</small>
    </div>
    ${interim}
  `;
}

// The set above leans on an egg or Sketch donor the player will field in the
// interim. This panel answers "how do I use the donor meanwhile": its own
// recommended moves at the current progression, from the same pipeline as
// every team member.
function renderDonorInterimGuides(guides) {
  if (!guides?.length) return '';

  return guides
    .map((guide) => {
      const forText = guide.forMoves.map((move) => move.name).join(', ');
      const chainTip = guide.forMoves
        .map((move) => `${move.name}${move.detail ? ` — ${move.detail}` : ''}`)
        .join('\n');
      const fieldedNote =
        guide.fieldedName && guide.fieldedName !== guide.donorName
          ? ` (field ${guide.fieldedName} for now)`
          : '';
      // The donor retires when it levels into its last donated move, so its
      // guide is pinned one level below that — say so in the header.
      const capNote = guide.interimCapped ? ` ≤ Lv ${guide.interimLevelCap}` : '';

      return `
        <details class="team-set-donor">
          <summary title="${escapeAttr(chainTip)}"><small>Interim donor: ${escapeHtml(
            guide.donorName,
          )}${escapeHtml(capNote)}${escapeHtml(fieldedNote)} — supplies ${escapeHtml(forText)}</small></summary>
          ${renderSetMoves(
            guide.moves, 'No usable damaging moves at the current cap.')}
        </details>
      `;
    })
    .join('');
}

// A set's moves as a list, or the note that stands for an empty one.
function renderSetMoves(moves, emptyNote) {
  return moves.length
    ? `<ul class="team-set-moves">${moves.map(renderSetMove).join('')}</ul>`
    : `<p class="team-set-moves-empty muted">${escapeHtml(emptyNote)}</p>`;
}

const badgeCount = (badges) => `${badges} badge${badges === 1 ? '' : 's'}`;

function renderSetMove(move) {
  const facts = describeMoveMeta(getMoveMeta(move.name));
  const sourceTitle = move.sourceTitle || move.sourceLabel || 'Legal';
  return `
    <li class="team-set-move">
      ${renderTypeBadge(move.type)}
      <span class="team-set-move-name"${facts ? ` title="${escapeHtml(facts)}"` : ''}>${escapeHtml(move.name)}${move.standsInFor ? ` <small class="team-set-move-standin" title="${escapeAttr(`Stands in for ${move.standsInFor.name}, a move of this set that cannot be learned yet`)}">for ${escapeHtml(move.standsInFor.name)}</small>` : ''}${move.locked ? ' <small class="team-set-move-lock" title="Locked in the pool: this move is in every set built for the line">locked</small>' : ''}</span>
      <span class="team-set-move-dmg"${move.damageSteps?.length ? ` title="${escapeAttr(move.damageSteps.join('\n'))}"` : ''}>${escapeHtml(formatDamage(move))}</span>
      <span class="team-set-move-src" title="${escapeAttr(sourceTitle)}">${escapeHtml(move.sourceLabel || 'Legal')}</span>
    </li>
  `;
}

function formatEvs(evs) {
  const line = formatEvLine(evs);
  return line ? `EVs: ${line}` : '';
}

// The first few names of a list, saying how many it leaves out, so a count
// beside it is never larger than what the reader can see accounted for.
function listSome(names, limit) {
  const shown = names.slice(0, limit).join(', ');
  return names.length > limit
    ? `${shown} +${names.length - limit} more`
    : shown;
}

// A tile's figure is coloured only where it is a verdict (`tone`: 'ok' or
// 'warn'); its detail line says the same in words.
function renderSummaryCard({ detail, label, tone = '', value }) {
  return `
    <div class="team-analysis-summary-card">
      <span>${escapeHtml(label)}</span>
      <strong${tone ? ` class="is-${tone}"` : ''}>${escapeHtml(value)}</strong>
      <p>${escapeHtml(detail)}</p>
    </div>
  `;
}

// A table of the analysis: a real one, so a screen reader reads it row by
// row under its column names. `headers` are shown only where the cells do
// not say what they are (`showHeaders`). The roles are spelled out because
// the rows are laid out as grids on a narrow screen, which can cost a
// table its meaning.
function renderAnalysisTable({ label, headers, rows, showHeaders = false }) {
  return `
    <table class="team-analysis-table" role="table" aria-label="${escapeAttr(label)}">
      <thead role="rowgroup"${showHeaders ? '' : ' class="visually-hidden"'}>
        <tr role="row">
          ${headers.map((header) => `<th role="columnheader" scope="col">${escapeHtml(header)}</th>`).join('')}
        </tr>
      </thead>
      <tbody role="rowgroup">
        ${rows.join('')}
      </tbody>
    </table>
  `;
}

function renderDefensiveRows(sharedWeaknesses, sturdySwitchTypes) {
  return `
    <div class="team-analysis-block">
      <h4>Shared weaknesses</h4>
      ${
        sharedWeaknesses.length
          ? renderAnalysisTable({
            label: 'Shared weaknesses',
            headers: ['Attacking type', 'Weak', 'Cover', 'Picks'],
            rows: sharedWeaknesses.map((entry) =>
              renderDefenseTypeRow(entry, {
                primary: `${entry.weak.length} weak`,
                secondary:
                    entry.immune.length > 0
                      ? `${entry.immune.length} immune`
                      : `${entry.resist.length} resist`,
              }),
            ),
          })
          : `<p class="muted">No shared weaknesses across the current picks.</p>`
      }
    </div>

    <div class="team-analysis-block">
      <h4>Resists and immunities</h4>
      ${
        sturdySwitchTypes.length
          ? renderAnalysisTable({
            label: 'Resists and immunities',
            headers: ['Attacking type', 'Cover', 'Weak', 'Picks'],
            rows: sturdySwitchTypes.slice(0, 8).map((entry) =>
              renderDefenseTypeRow(entry, {
                primary: `${getCoverCount(entry)} cover`,
                secondary:
                    entry.weak.length > 0 ? `${entry.weak.length} weak` : 'no weak',
              }),
            ),
          })
          : `<p class="muted">No attack type has multiple resists or immunities.</p>`
      }
    </div>
  `;
}

function renderDefenseTypeRow(entry, { primary, secondary }) {
  return `
    <tr role="row">
      <td role="cell">${renderTypeBadge(entry.type)}</td>
      <td role="cell"><strong>${escapeHtml(primary)}</strong></td>
      <td role="cell">${escapeHtml(secondary)}</td>
      <td role="cell"><small>${escapeHtml(formatDefenseNames(entry))}</small></td>
    </tr>
  `;
}

function renderCoverageSummary(offensive) {
  const weakestHits = offensive.bestCoverageByTarget
    .filter((entry) => entry.best)
    .slice(0, 6);

  return `
    <div class="team-analysis-block">
      <h4>No super-effective answer</h4>
      ${
        offensive.missingSuperEffectiveTargets.length
          ? `<div class="team-analysis-chip-list">${offensive.missingSuperEffectiveTargets.map(renderTypeBadge).join('')}</div>`
          : `<p class="muted">The recommended attacks hit every type super effectively.</p>`
      }
    </div>

    <div class="team-analysis-block">
      <h4>Thinnest super-effective answers</h4>
      <p class="muted team-analysis-hint">Types you can only hit super effectively with a weak move.</p>
      ${
        weakestHits.length
          ? renderAnalysisTable({
            label: 'Thinnest super-effective answers',
            headers: ['Target', 'Damage', 'With', 'Move'],
            rows: weakestHits.map(renderCoverageTargetRow),
            showHeaders: true,
          })
          : `<p class="muted">No super-effective recommended hits are available yet.</p>`
      }
    </div>
  `;
}

function renderCoverageTargetRow(entry) {
  const best = entry.best;

  return `
    <tr role="row"${best ? '' : ' class="warning"'}>
      <td role="cell">${renderTypeBadge(entry.type)}</td>
      <td role="cell"><strong>${best ? formatPower(best.estimatedDamage) : 'none'}</strong></td>
      <td role="cell">${best ? escapeHtml(best.attackType) : 'missing'}</td>
      <td role="cell"><small>${
        best
          ? escapeHtml(`${best.moveName} from ${best.memberName}`)
          : 'No recommended super-effective hit'
      }</small></td>
    </tr>
  `;
}

function formatPower(value) {
  if (!Number.isFinite(value)) return '';

  return Math.round(value).toLocaleString();
}

function formatDamage(move) {
  if (!move) return '';
  // A status move deals none by design; "0 dmg" would read as a dud.
  if (move.category === 'Status') return 'status';

  const damage = Number.isFinite(move.estimatedDamage)
    ? `${formatPower(move.estimatedDamage)} dmg`
    : '';
  const category = formatCategory(move.category);

  if (damage && category) return `${damage} · ${category}`;
  return damage || category;
}

function formatCategory(category) {
  if (category === 'Physical') return 'Phys';
  if (category === 'Special') return 'Spec';
  return '';
}

function formatDefenseNames(entry) {
  const weak = entry.weak.map(({ member }) => member.name);
  const cover =
    [...entry.resist, ...entry.immune].map(({ member }) => member.name);

  if (weak.length && cover.length) {
    return `${weak.join(', ')} covered by ${cover.join(', ')}`;
  }

  if (weak.length) return weak.join(', ');
  if (cover.length) return cover.join(', ');

  return 'Neutral across team';
}

function getCoverCount(entry) {
  return entry.resist.length + entry.immune.length;
}

function renderTypeBadge(type) {
  const safeType = analysisTypes().includes(type) ? type : 'Normal';

  return `
    <span class="move-badge team-analysis-type-badge" style="${badgeStyle(getTypeColor(safeType))}">
      ${escapeHtml(type)}
    </span>
  `;
}

