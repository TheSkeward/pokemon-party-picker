/**
 * @fileoverview Measures how long a Pokémon stays on the field from public
 * Showdown replay logs: per battle, the turn count, faints, and every stint
 * (turns between a switch-in and the next switch, drag, or the end). The
 * damage model's EXPECTED_STINT_TURNS (src/teamBuilder/damage-model.js)
 * is set from this. Ladder play switches far more than a trainer fight, so
 * the ladder stint is a floor and turns per knockout the better guide.
 *
 *   node scripts/measure-stints.mjs [format] [pages]
 *
 * Reads replay.pokemonshowdown.com's search JSON (about 50 replays a page)
 * and each replay's raw log. Output is one JSON line of summary figures.
 */

const format = process.argv[2] || 'gen7ou';
const pages = Number(process.argv[3] || 3);

async function replayIds() {
  const ids = [];
  for (let page = 1; page <= pages; page += 1) {
    const url =
      `https://replay.pokemonshowdown.com/search.json?format=${format}&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`replay search failed: HTTP ${res.status}`);
    for (const entry of await res.json()) ids.push(entry.id);
  }
  return ids;
}

// A stint opens at |switch| or |drag| for that side and closes at the next
// one on the same side, or at the last turn.
function measure(log) {
  const stints = [];
  const open = { p1: null, p2: null };
  let turns = 0;
  let faints = 0;
  let currentTurn = 0;
  for (const line of log.split('\n')) {
    const parts = line.split('|');
    const kind = parts[1];
    if (kind === 'turn') {
      currentTurn = Number(parts[2]);
      turns = Math.max(turns, currentTurn);
    } else if (kind === 'faint') {
      faints += 1;
    } else if (kind === 'switch' || kind === 'drag') {
      const side = parts[2].slice(0, 2);
      if (open[side]) stints.push(Math.max(1, currentTurn - open[side]));
      open[side] = Math.max(1, currentTurn);
    }
  }
  for (const side of ['p1', 'p2']) {
    if (open[side]) stints.push(Math.max(1, turns - open[side] + 1));
  }
  return { turns, faints, stints };
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
};
const mean = (values) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

const games = [];
for (const id of await replayIds()) {
  const res = await fetch(`https://replay.pokemonshowdown.com/${id}.log`);
  if (!res.ok) continue;
  const game = measure(await res.text());
  if (game.turns >= 3) games.push(game);
}
const stints = games.flatMap((game) => game.stints);
console.log(JSON.stringify({
  format,
  games: games.length,
  medianTurns: median(games.map((game) => game.turns)),
  meanTurns: Number(mean(games.map((game) => game.turns)).toFixed(1)),
  medianTurnsPerKo: Number(
    median(games.map((game) => game.turns / Math.max(1, game.faints)))
      .toFixed(2),
  ),
  stints: stints.length,
  medianStint: median(stints),
  meanStint: Number(mean(stints).toFixed(2)),
  stintAtMost: [1, 2, 3, 4, 5, 6, 8].map((n) => [
    n,
    Number((stints.filter((s) => s <= n).length / stints.length).toFixed(2)),
  ]),
}));
