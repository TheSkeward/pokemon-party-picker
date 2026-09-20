# Pokemon Party Picker

A static web app for planning playthrough teams from the Pokemon you
currently have available, for Pokemon Reborn, Pokemon HeartGold and
SoulSilver (HGSS), and Pokemon Black 2 and White 2 (B2W2).

The app uses Smogon usage data of the game's generation (Gen 7 for Reborn,
Gen 4 for HGSS, Gen 5 for B2W2) as a prior for which forms, sets, and teammates are
worth considering, then checks those ideas against the game's progression:
level caps, TMs and HMs, tutors, move relearner, daycare, evolution access,
held items, legal moves, coverage, and defensive fit.

Live site:

https://theskeward.github.io/pokemon-party-picker/

## Features

- Paste an owned Pokemon pool and get a recommended team.
- Lock a Pokemon into the team by suffixing it with `!` (`Gengar!`);
  the optimizer fills the remaining slots around it.
- Track each game's progression locally in your browser.
- Inspect legal current moves, recommended sets, breeding chains, item picks,
  coverage, defensive profile, confidence, and level-cap investment.
- Look up observed set details for a Pokemon or evolutionary line.
- Browse the underlying usage data.

## Games

The usage-data families in the top tabs (Singles, Doubles, Gen 4 Singles,
Gen 5 Singles) come from the data pipeline, and each activates the game
whose prior it is: Reborn for the Gen 7 families, HGSS for Gen 4, B2W2 for
Gen 5. A game is a descriptor
in `src/games/` naming its dex generation, usage families, progression
schedule, machines and tutors, item content, evolution rules, and the
mechanics it has (Reborn's Common Candy level-downs and Hidden Power Type
Changer, for instance); its curated data lives in `src/reborn/`,
`src/hgss/`, or `src/b2w2/`. Legal moves come from the game's own data: Reborn's from
its mons.dat, a mainline game's from `@pkmn/dex` with the game's level-up
lists taken from Bulbapedia where its generation's games differ.

The usage prior is per generation, not per game: competitive play describes
a mainline game well enough that only Reborn, whose mechanics stray far from
it, carries a calibration corpus (see `SCORING.md`).

The tool wears the active game's palette: its descriptor supplies the
shell, text, state, and accent colors and whether they are a dark or light
scheme, all drawn from the game's own UI (Reborn's dark menus and relic
gems; HGSS's cream-and-white screens; B2W2's black screens and Bag
blues). Only the fills for actions, focus,
progress, and highlights hold across games. Every text color clears WCAG AA
on the game's surfaces, pinned by test.

## Running Locally

```bash
npm install
npm run dev
```

The dev server runs at:

```text
http://localhost:5173/
```

Production build:

```bash
npm run build
npm run preview
```

## Useful Commands

```bash
npm test                       # fast mechanical/correctness tests
npm run validate:calibration   # badge-bucket scorer calibration
npm run e2e                    # browser-level smoke tests
npm run build:site             # manifest + Vite build + copied static data
npm run refresh:data           # regenerate checked-in Smogon/Reborn-derived data
```

Changes to the scoring engine, its mechanical/data inputs, its generators, the
calibration harness, or dependencies trigger the scoring-calibration CI
workflow. Such changes must pass both `npm test` and
`npm run validate:calibration`; UI-only and documentation-only changes do not
pay for the expensive calibration run.

The app is fully static. Runtime data is checked in under `site-data/data/`,
and generated JS modules are checked in under `src/generated/`, so ordinary
builds do not need network access.

## Project Layout

```text
index.html / src/main.js      Main app
pool.html  / src/pool-app.js   Team Builder-only page
src/app/                       App shell and page wiring
src/views/                     Shared render views
src/teamBuilder/               Pool parsing, scoring, search, analysis, UI
src/playthrough/               Progression state, move legality, evolution, breeding
src/games/                     Game registry and descriptors (Reborn, HGSS, B2W2)
src/reborn/, src/hgss/, src/b2w2/  Each game's curated data
src/resolver/                  Input-name and representative resolution
src/setDetails/                Precomputed set-detail loading
src/generated/                 Checked-in generated modules
site-data/data/                Checked-in runtime JSON
scripts/                       Data generation scripts
test/                          Fast correctness, E2E, and badge-anchor calibration
```

The scoring model and its change policy are documented in `SCORING.md`.
Read that before changing optimizer behavior or scoring constants.

## Data And Cache Notes

- If generated data changes, run `npm run build:manifest` before committing.
  The manifest hashes runtime data and generated modules so browser caches can
  invalidate correctly.
- If optimizer output changes without a data-signature change, bump
  `RESULT_CACHE_VERSION` in `src/teamBuilder/team-optimizer.js`.
- `npm run refresh:data` may need network access because it downloads Smogon
  stats.

## Deploy

GitHub Actions builds and deploys the app to GitHub Pages from `main`.
Scheduled refreshes can update generated data and commit those results back to
the repository.
