// Team-scrape pipeline units: the Showdown paste parser, replay-log
// composition extraction, and the two derived-index builders, all on
// synthetic fixtures (the real archives are CI-harvested).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { parseShowdownTeam, parseShowdownSet } = await import(
  '../scripts/teamscrape/parse-showdown-team.mjs',
);
const { parseReplayTeams, toTeamSheetId } = await import(
  '../scripts/teamscrape/replay-log.mjs',
);
const { buildObservedSetIndex, readArchive } = await import(
  '../scripts/build-observed-sets.mjs',
);
const { appendJsonlRecord, readJsonlLatest } = await import(
  '../scripts/teamscrape/jsonl-records.mjs',
);
const { collectCompositions, buildCoreIndex } = await import(
  '../scripts/build-core-index.mjs',
);

const PASTE = `=== [gen7ou] Sample ===

Landorus-Therian (M) @ Rocky Helmet
Ability: Intimidate
EVs: 252 HP / 240 Def / 16 Spe
Impish Nature
- Stealth Rock
- Earthquake
- U-turn
- Hidden Power [Ice]

Chansey (F) @ Eviolite
Ability: Natural Cure
Level: 97
EVs: 4 HP / 252 Def / 252 SpD
Bold Nature
IVs: 0 Atk
- Soft-Boiled
- Toxic
- Seismic Toss
- Stealth Rock

garbage block without any set shape
that should be dropped not fatal`;

test('parseShowdownTeam reads sets, tolerates junk blocks', () => {
  const { sets, dropped, format } = parseShowdownTeam(PASTE);
  assert.equal(format, 'gen7ou'); // read from the === header
  assert.equal(sets.length, 2);
  assert.equal(dropped, 1);
  const lando = sets[0];
  assert.equal(lando.speciesId, 'landorustherian');
  assert.equal(lando.itemId, 'rockyhelmet');
  assert.equal(lando.abilityId, 'intimidate');
  assert.equal(lando.nature, 'Impish');
  assert.deepEqual(lando.evs, { hp: 252, def: 240, spe: 16 });
  assert.equal(lando.moveIds[3], 'hiddenpowerice');
  const chansey = sets[1];
  assert.equal(chansey.level, 97);
  assert.deepEqual(chansey.ivs, { atk: 0 });
});

test('header variants: nickname, gender, itemless', () => {
  assert.equal(
    parseShowdownSet('Big Bird (Zapdos) @ Leftovers\n- Roost').speciesId,
    'zapdos',
  );
  assert.equal(parseShowdownSet('Mimikyu (F)\n- Play Rough').speciesId, 'mimikyu');
  assert.equal(parseShowdownSet('Mimikyu (F)\n- Play Rough').item, null);
  // Forum commentary directly above a set's lines is not a species.
  assert.equal(
    parseShowdownSet(
      'Does its job perfectly! Fake out to get rid of sash users\nAbility: Berserk\n- Fake Out',
    ),
    null,
  );
});

test('replay teams: poke lines union switch reveals, forms collapse', () => {
  const log = [
    '|poke|p1|Mawile, F|item',
    '|poke|p1|Skuntank, M|',
    '|poke|p2|Yanmega, M|',
    '|switch|p1a: May|Mawile-Mega, F|100/100',
    '|switch|p2a: Zoro|Zoroark, M|100/100',
  ].join('\n');
  const [p1, p2] = parseReplayTeams(log);
  assert.deepEqual(p1.map(toTeamSheetId).sort(), ['mawile', 'mawile', 'skuntank']);
  assert.deepEqual(p2, ['yanmega', 'zoroark']);
  assert.equal(toTeamSheetId('yanmega'), 'yanmega');
  assert.equal(toTeamSheetId('charizardmegax'), 'charizard');
});

const SAMPLE_TEAMS = [
  {
    format: 'gen7ou',
    sets: [
      {
        speciesId: 'skuntank', species: 'Skuntank', itemId: 'blacksludge',
        item: 'Black Sludge', abilityId: 'aftermath', ability: 'Aftermath',
        nature: 'Adamant', evs: { hp: 252, atk: 252 },
        moves: ['Crunch', 'Poison Jab', 'Sucker Punch', 'Taunt'],
        moveIds: ['crunch', 'poisonjab', 'suckerpunch', 'taunt'],
      },
    ],
  },
  {
    format: 'gen7ou',
    sets: [
      {
        speciesId: 'skuntank', species: 'Skuntank', itemId: 'blacksludge',
        item: 'Black Sludge', abilityId: 'aftermath', ability: 'Aftermath',
        nature: 'Adamant', evs: { hp: 252, atk: 252 },
        moves: ['Crunch', 'Poison Jab', 'Sucker Punch', 'Taunt'],
        moveIds: ['crunch', 'poisonjab', 'suckerpunch', 'taunt'],
      },
    ],
  },
  { format: 'gen9ou', sets: [{ speciesId: 'x', moveIds: ['a'] }] },
];

test('observed-set index dedups identical sets and skips unknown formats', () => {
  const byFamily = buildObservedSetIndex(SAMPLE_TEAMS);
  assert.deepEqual([...byFamily.keys()], ['singles']);
  const detail = byFamily.get('singles').get('skuntank');
  assert.equal(detail.sets.length, 1);
  assert.equal(detail.sets[0].count, 2);
  assert.equal(detail.sets[0].item, 'Black Sludge');
});

test('JSONL revisions are append-only but archive consumers use the latest', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-jsonl-'));
  const file = path.join(dir, 'forum-gen7ou.jsonl');
  const latest = readJsonlLatest(file);
  assert.equal(
    appendJsonlRecord(file, { id: 'post-1', sets: ['old'] }, latest),
    true,
  );
  assert.equal(
    appendJsonlRecord(file, { id: 'post-1', sets: ['old'] }, latest),
    false,
  );
  assert.equal(
    appendJsonlRecord(file, { id: 'post-1', sets: ['revised'] }, latest),
    true,
  );
  assert.deepEqual(readArchive(dir, 'forum-'), [
    { id: 'post-1', sets: ['revised'] },
  ]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('core index: symmetric lift, min pair support, quality weighting', () => {
  const replays = [
    { format: 'gen7uu', rating: 1800, teams: [['aggron', 'blissey', 'crobat'], ['aggron', 'blissey', 'crobat']] },
    { format: 'gen7uu', rating: null, teams: [['aggron', 'crobat', 'emolga'], ['blissey', 'dugtrio', 'flygon']] },
  ];
  const byFamily = collectCompositions({ replays, samples: [] });
  const index = buildCoreIndex(byFamily.get('singles'));
  const aggron = index.get('aggron');
  // aggron+blissey: 1.0 per side of the 1760+ replay = 2.0, at the pair
  // floor. Symmetric across both files.
  assert.equal(aggron.partners.blissey.count, 2);
  assert.equal(index.get('blissey').partners.aggron.lift, aggron.partners.blissey.lift);
  // emolga only appears in the unrated mixture (0.005/pair) — floored out.
  assert.equal(index.get('emolga'), undefined);
  assert.ok(aggron.trios.length >= 1);
});


const {
  htmlToText,
  extractThreadRows,
  extractFirstPostText,
  hasNextPage,
} = await import(
  '../scripts/teamscrape/forum-html.mjs',
);
const {
  forListing,
  importLegacyThreads,
  recordDeferredThread,
  nextThreadPage,
  readCrawlState,
  recordListingPage,
  recordThreadPage,
  saveCrawlState,
  shouldScanThread,
} = await import('../scripts/teamscrape/crawl-state.mjs');

test('rmt: listing rows carry prefixes, first post yields inline sets', () => {
  // Smogon's markup: site-rooted hrefs (/forums/threads/...) inside
  // structItem-title blocks. The early harvests read a whole listing of
  // labeled threads as unlabeled because a flat proximity regex
  // mis-associated labels across row furniture; block scoping is the fix.
  const listing = `
    <div class="structItem-title">
      <span class="label label--primary">Gen 7</span>
      <a href="/forums/threads/my-cool-team.3651234/" data-preview-url="/forums/threads/3651234/preview">My cool OU team</a>
    </div>
    <time data-time="1700000000"></time>
    <a href="/forums/threads/my-cool-team.3651234/latest">jump</a>
    <div class="structItem-title">
      <a href="/threads/unlabeled-thread.999/" data-preview-url="x">No prefix</a>
    </div>`;
  const rows = extractThreadRows(
    listing, 'https://www.smogon.com/forums/forums/past-gen-teams.319/');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].prefix, 'Gen 7');
  assert.equal(rows[0].threadId, '3651234');
  assert.equal(rows[0].title, 'My cool OU team');
  assert.equal(rows[0].updatedAt, 1700000000);
  assert.equal(
    rows[0].url,
    'https://www.smogon.com/forums/threads/my-cool-team.3651234/',
  );
  assert.equal(rows[1].prefix, null);

  const post = `<article class="message-body js-selectToQuote"><div class="bbWrapper">
    Skuntank @ Black Sludge<br>Ability: Aftermath<br>Adamant Nature<br>- Crunch<br>- Poison Jab
  </div></article>`;
  const { sets } = parseShowdownTeam(extractFirstPostText(post));
  assert.equal(sets.length, 1);
  assert.equal(sets[0].speciesId, 'skuntank');
  assert.equal(htmlToText('a &amp; b<br>c'), 'a & b\nc');
});

test('forum text: XenForo source newlines preserve importable boundaries',
  () => {
    const html = [
      'Skuntank @ Black Sludge<br />\n',
      'Ability: Aftermath<br />\n',
      '- Crunch<br />\n',
      '- Poison Jab<br />\n',
      '<br />\n',
      'Crobat @ Leftovers<br />\n',
      'Ability: Infiltrator<br />\n',
      '- Brave Bird<br />\n',
      '- Roost<br />\n',
    ].join('');
    const text = htmlToText(html);
    assert.match(text, /Poison Jab\n\nCrobat/);
    assert.deepEqual(
      parseShowdownTeam(text).sets.map((set) => set.speciesId),
      ['skuntank', 'crobat'],
    );
  });

test('forum pagination follows XenForo next links without a hard ceiling', () => {
  assert.equal(
    hasNextPage(
      '<a class="pageNav-jump pageNav-jump--next" href="page-13">Next</a>',
      12,
    ),
    true,
  );
  assert.equal(
    hasNextPage('<link rel="next" href="page-101">', 100),
    true,
  );
  assert.equal(
    hasNextPage('<a class="pageNav-page" data-page="7">7</a>', 7),
    false,
  );
});

test('forum crawl state resumes legacy markers and cycles listing sweeps', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-crawl-'));
  const legacy = path.join(dir, 'threads.jsonl');
  const stateFile = path.join(dir, 'state.json');
  fs.writeFileSync(
    legacy,
    '{"id":"123","thread":"https://example.test/threads/x.123/"}\n',
  );
  const state = readCrawlState(stateFile);
  assert.equal(importLegacyThreads(state, legacy), 1);
  assert.equal(nextThreadPage(state.threads['123']), 1);

  const row = {
    threadId: '123',
    url: 'https://example.test/threads/x.123/',
    updatedAt: 50,
  };
  assert.equal(shouldScanThread(state.threads['123'], row, 0), true);
  recordThreadPage(state, row, { page: 1, hasNext: true, sweep: 0 });
  assert.equal(nextThreadPage(state.threads['123']), 2);
  recordThreadPage(state, row, { page: 2, hasNext: false, sweep: 0 });
  assert.equal(shouldScanThread(state.threads['123'], row, 0), false);
  assert.equal(
    shouldScanThread(state.threads['123'], { ...row, updatedAt: 51 }, 0),
    true,
  );

  const listing = forListing(state, 'https://example.test/forums/x/');
  assert.equal(
    recordListingPage(state, 'https://example.test/forums/x/', 1, true),
    true,
  );
  assert.equal(listing.page, 2);
  assert.equal(
    recordListingPage(state, 'https://example.test/forums/x/', 2, false),
    false,
    'the harvest stops when the cursor wraps instead of starting sweep 2',
  );
  assert.deepEqual(listing, { page: 1, sweep: 1 });
  saveCrawlState(stateFile, state);
  assert.deepEqual(readCrawlState(stateFile), state);
  fs.rmSync(dir, { recursive: true, force: true });
});


const { WEIGHTS, replayWeight, teamWeight } = await import(
  '../scripts/teamscrape/weights.mjs',
);
const { replayLinkFormat, extractReplayIds } = await import(
  '../scripts/scrape-tournament-teams.mjs',
);
const { createForumFetcher, isSmogonForumUrl } = await import(
  '../scripts/teamscrape/forum-fetch.mjs',
);

test('weight ladder: bands, tournament override, unrated-mixture inversion', () => {
  assert.equal(replayWeight({ rating: null }), WEIGHTS.unrated_replay);
  assert.equal(replayWeight({ rating: 1400 }), WEIGHTS.rated_below_1500);
  assert.ok(replayWeight({ rating: null }) > replayWeight({ rating: 1400 }));
  assert.equal(replayWeight({ rating: 1630 }), 0.2);
  assert.equal(replayWeight({ rating: 1900 }), 1.0);
  assert.equal(replayWeight({ rating: null, source: 'tournament' }), 60);
  assert.equal(replayWeight({ rating: null, id: 'smogtours-gen7lc-957737' }), 60);
  assert.equal(replayWeight({ rating: null, id: 'rom-gen7nfe-852496' }), WEIGHTS.unrated_replay);
  assert.equal(teamWeight({ source: 'rmt' }), 5);
  assert.equal(teamWeight({ source: 'forum' }), WEIGHTS.forum_team);
  assert.equal(
    teamWeight({
      source: 'forum',
      thread: 'https://www.smogon.com/forums/threads/smogon-snake-draft-2019-ou-discussion.3653598/',
    }),
    40,
  );
  assert.equal(
    teamWeight({
      source: 'forum',
      thread: 'https://www.smogon.com/forums/threads/your-favorite-teams-of-the-generation.3654503/',
    }),
    20,
  );
  assert.equal(
    teamWeight({
      source: 'forum',
      thread: 'https://www.smogon.com/forums/threads/ask-the-mods.3655050/',
    }),
    WEIGHTS.forum_team,
  );
  assert.equal(teamWeight({ source: 'tournament' }), 60);
  assert.equal(teamWeight({}), 1000);
});

test('tournament: replay-link format attribution incl. smogtours ids', () => {
  assert.equal(replayLinkFormat('gen7ou-967241'), 'gen7ou');
  assert.equal(replayLinkFormat('smogtours-gen7uu-406712'), 'gen7uu');
  assert.equal(replayLinkFormat('gen9ou-1'), null); // untracked format
  assert.deepEqual(
    extractReplayIds(
      '<a href="https://replay.pokemonshowdown.com/smogtours-gen7ou-1234">g1</a> replay.pokemonshowdown.com/smogtours-gen7ou-1234 x',
    ),
    ['smogtours-gen7ou-1234'],
  );
});

test('tournament: dump sections and labels attribute pastes and inline teams', async () => {
  const { findLabels, genFromLabel } = await import(
    '../scripts/teamscrape/tier-names.mjs',
  );
  const { attributeFormat, sectionInlineTeams, threadContext } = await import(
    '../scripts/scrape-tournament-teams.mjs',
  );
  assert.equal(genFromLabel('USM Ubers'), 7);
  assert.equal(genFromLabel('B2W2 OU'), 5);
  assert.equal(genFromLabel('no generation here'), null);
  assert.deepEqual(
    findLabels('ADV\nteam\n\nDPP Ubers: link\nSM Doubles vs X'),
    [
      { index: 0, gen: 3, tier: null },
      { index: 10, gen: 4, tier: 'ubers' },
      { index: 26, gen: 7, tier: 'doublesou' },
    ],
  );

  // A pin says what a multi-generation dump leaves unsaid; a prefix or the
  // title says the rest for listing threads.
  const upl = threadContext({ title: 'UPL VII dump', prefixFormat: null,
    pin: { tier: 'ubers' } });
  assert.deepEqual(upl, { format: null, gen: null, tier: 'ubers' });
  const cup = threadContext({ title: 'SM OU Cup III - Finals',
    prefixFormat: null, pin: {} });
  assert.deepEqual(cup, { format: null, gen: 7, tier: 'ou' });
  assert.equal(threadContext({ title: 'x', prefixFormat: 'gen7uu',
    pin: {} }).format, 'gen7uu');

  // Nearest evidence outward: label gen + thread tier, label alone, the
  // post's single replay format, the thread; untracked results are null.
  assert.equal(attributeFormat({ label: { gen: 4, tier: null },
    replayFormat: null, thread: upl }), 'gen4ubers');
  assert.equal(attributeFormat({ label: { gen: 3, tier: null },
    replayFormat: 'gen7ubers', thread: upl }), null);
  assert.equal(attributeFormat({ label: { gen: 7, tier: 'ou' },
    replayFormat: 'gen7ubers', thread: upl }), 'gen7ou');
  assert.equal(attributeFormat({ label: null,
    replayFormat: 'gen7doublesou', thread: { format: null, gen: null,
      tier: null } }), 'gen7doublesou');
  assert.equal(attributeFormat({ label: null, replayFormat: null,
    thread: cup }), 'gen7ou');
  assert.equal(attributeFormat({ label: null, replayFormat: null,
    thread: { format: null, gen: null, tier: 'ubers' } }), null);

  // Inline teams never group across a section heading.
  const set = (species) =>
    `${species} @ Leftovers\nAbility: Pressure\n- Protect\n- Toxic\n`;
  const names = ['Toxapex', 'Ferrothorn', 'Heatran', 'Latios', 'Kyogre',
    'Xerneas', 'Groudon', 'Arceus', 'Yveltal', 'Magearna'];
  const text = [
    'some intro', 'DPP', ...names.slice(0, 6).map(set),
    'USM Ubers', ...names.slice(6).map(set),
  ].join('\n\n');
  const sections = sectionInlineTeams(text);
  assert.deepEqual(
    sections.map((section) => [section.label?.gen, section.label?.tier,
      section.teams.map((team) => team.length)]),
    [[4, null, [6]], [7, 'ubers', [4]]],
  );
});

test('an empty forum is recorded and left unfetched for a month', async () => {
  const { describeEmptyListing } = await import(
    '../scripts/teamscrape/forum-html.mjs',
  );
  const { skipsEmptyListing, walkListingPages } = await import(
    '../scripts/teamscrape/listing-walk.mjs',
  );
  const { recordEmptyListing } = await import(
    '../scripts/teamscrape/crawl-state.mjs',
  );
  const empty =
    '<div class="block-body"><div class="blockMessage">' +
    'There are no threads in this forum.</div></div>';
  const container =
    '<h3 class="node-title"><a href="/forums/forums/child.9/">Child</a></h3>' +
    empty;
  assert.deepEqual(describeEmptyListing(empty), { subforums: 0 });
  assert.deepEqual(describeEmptyListing(container), { subforums: 1 });
  assert.equal(describeEmptyListing('<div class="structItem-title">x</div>'),
    null);

  const now = new Date('2026-09-20T00:00:00Z');
  const seen = { page: 1, sweep: 0 };
  recordEmptyListing({ listings: { l: seen }, threads: {} }, 'l', now);
  assert.equal(seen.emptyAt, now.toISOString());
  assert.ok(skipsEmptyListing(seen, new Date('2026-10-10T00:00:00Z')));
  assert.ok(!skipsEmptyListing(seen, new Date('2026-10-25T00:00:00Z')));
  assert.ok(!skipsEmptyListing({ page: 1, sweep: 0 }));

  // First run: the page is fetched and processed once (the container case
  // still discovers subforums), then recorded empty; the next run skips.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-listing-'));
  const crawlFile = path.join(dir, 'crawl.json');
  const crawl = { version: 1, listings: {}, threads: {} };
  const fetched = [];
  const processed = [];
  const walk = () => walkListingPages({
    listing: 'https://example.test/forums/empty.1/',
    fetchText: async (url) => {
      fetched.push(url);
      return empty;
    },
    processPage: async (html, page) => {
      processed.push(page);
      return { handled: true, next: false };
    },
    crawl,
    crawlFile,
    listingPagesPerRun: 4,
    outOfBudget: () => false,
  });
  await walk();
  assert.equal(fetched.length, 1);
  assert.deepEqual(processed, [1]);
  assert.ok(crawl.listings['https://example.test/forums/empty.1/'].emptyAt);
  await walk();
  assert.equal(fetched.length, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('forum roots carry their generation; link forums are not subforums', async () => {
  const { extractSubforums, forumRoots } = await import(
    '../scripts/scrape-forum-teams.mjs',
  );
  assert.deepEqual(
    forumRoots({
      gen: 'gen7',
      listings: [
        'https://www.smogon.com/forums/forums/gen-7-competitive-discussion.249/',
        { url: 'https://www.smogon.com/forums/forums/dpp/', gen: 'gen4' },
      ],
    }),
    [
      {
        listing: 'https://www.smogon.com/forums/forums/gen-7-competitive-discussion.249/',
        gen: 'gen7',
        tier: null,
      },
      { listing: 'https://www.smogon.com/forums/forums/dpp/', gen: 'gen4', tier: null },
    ],
  );
  const index = `
    <h3 class="node-title"><a href="/forums/forums/dpp-lower-tiers.1004/">DPP Lower Tiers</a></h3>
    <h3 class="node-title"><a href="/forums/link-forums/rate-my-team-dpp.780/">Rate My Team (DPP)</a></h3>
    <h3 class="node-title"><a href="/forums/forums/dpp-archive.944/">DPP Archive</a></h3>`;
  assert.deepEqual(
    extractSubforums(index, 'https://www.smogon.com/forums/forums/dpp/')
      .map((sub) => sub.name),
    ['DPP Lower Tiers', 'DPP Archive'],
  );
});

test('replay harvest spends its budget on tours, then elite, then the rest', async () => {
  const { harvestFormat, isPriorityEntry } = await import(
    '../scripts/scrape-replay-teams.mjs',
  );
  assert.ok(isPriorityEntry({ id: 'smogtours-gen7ou-1', rating: null }));
  assert.ok(isPriorityEntry({ id: 'gen7ou-1', rating: 1630 }));
  assert.ok(!isPriorityEntry({ id: 'gen7ou-1', rating: 1629 }));
  assert.ok(!isPriorityEntry({ id: 'rom-gen7ou-1', rating: null }));

  // The rating-sorted list: a full page of elite games, then a page that
  // dips below the floor. The newest-first list: two pages, the second
  // short, holding two smogtours games and one strong ladder game among
  // the mixture.
  const elite = Array.from({ length: 51 }, (_, i) => ({
    id: `gen7ou-e${i}`, rating: 2100 - i, uploadtime: 9000 - i,
  }));
  const dip = [
    { id: 'gen7ou-d0', rating: 1650, uploadtime: 8000 },
    { id: 'gen7ou-d1', rating: 1500, uploadtime: 7999 },
  ];
  const newest = Array.from({ length: 51 }, (_, i) => ({
    id: i === 3 ? 'smogtours-gen7ou-t0' : `gen7ou-n${i}`,
    rating: i === 1 ? 1700 : null,
    uploadtime: 5000 - i,
  }));
  const older = [
    { id: 'smogtours-gen7ou-t1', rating: null, uploadtime: 4000 },
    { id: 'gen7ou-o1', rating: 1200, uploadtime: 3999 },
  ];
  const pages = {
    'sort=rating&page=1': elite,
    'sort=rating&page=2': dip,
    '': newest,
    'before=4950': older,
    'before=3999': [],
  };
  const requests = [];
  const fetchJson = async (url) => {
    requests.push(url);
    const search = url.match(/search\.json\?format=gen7ou&?(.*)$/);
    if (search) {
      assert.ok(search[1] in pages, `unexpected search ${search[1]}`);
      return pages[search[1]];
    }
    const id = url.match(/\/([a-z0-9-]+)\.json$/)[1];
    return {
      id, uploadtime: 1, rating: null,
      log: '|poke|p1|Mawile, F|\n|poke|p2|Yanmega, M|',
    };
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-priority-'));
  const file = path.join(dir, 'replays-gen7ou.jsonl');
  const cursor = {};
  const now = new Date('2026-09-20T00:00:00Z');

  // A tight budget: the fresh region's smogtours games first, then its
  // strong game, then the top of the elite list; the backfill cursor is
  // planted where the fresh read ended.
  const first = await harvestFormat('gen7ou',
    { maxNew: 5, fetchJson, file, cursor, now });
  assert.deepEqual(first.passes, { tours: 3, elite: 2, fresh: 0, rest: 0 });
  assert.equal(cursor.restBefore, 3999);
  assert.equal(cursor.scanDone, true);
  assert.deepEqual(
    fs.readFileSync(file, 'utf8').trim().split('\n')
      .map((line) => JSON.parse(line).id),
    ['smogtours-gen7ou-t0', 'smogtours-gen7ou-t1', 'gen7ou-n1',
      'gen7ou-e0', 'gen7ou-e1'],
  );

  // A wide budget finishes the elite pass and rests it, takes the rest of
  // the fresh region, and finds the backfill already at the end.
  const second = await harvestFormat('gen7ou',
    { maxNew: 1000, fetchJson, file, cursor, now });
  assert.deepEqual(second.passes, { tours: 0, elite: 50, fresh: 50, rest: 0 });
  assert.equal(cursor.eliteRestedAt, now.toISOString());
  assert.equal(cursor.restDone, true);
  assert.equal(
    fs.readFileSync(file, 'utf8').trim().split('\n').length, 105);

  // The rested elite pass makes no rating-sorted request for a month, and
  // a fully seen top page ends the fresh read at once.
  requests.length = 0;
  const third = await harvestFormat('gen7ou', { maxNew: 10, fetchJson, file,
    cursor, now: new Date('2026-10-05T00:00:00Z') });
  assert.equal(third.appended, 0);
  assert.deepEqual(requests, [
    'https://replay.pokemonshowdown.com/search.json?format=gen7ou',
  ]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('forum fetch: HTTP mode identifies itself and requests readable text',
  async () => {
    const calls = [];
    const fetcher = createForumFetcher({
      mode: 'http',
      requestGapMs: 0,
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return { ok: true, text: async () => 'forum html' };
      },
    });
    assert.equal(
      await fetcher.fetchText('https://www.smogon.com/forums/threads/x.1/'),
      'forum html',
    );
    assert.match(calls[0].options.headers['User-Agent'], /team harvester/);
    assert.match(calls[0].options.headers.Accept, /text\/html/);
    await fetcher.close();
  });

test('forum fetch: browser mode reuses one Smogon session only', async () => {
  const calls = { launches: 0, contexts: 0, pages: 0, http: 0 };
  const page = {
    goto: async (url) => ({
      status: () => 200,
      url: () => url,
      text: async () => `<html>${url}</html>`,
    }),
    close: async () => {},
  };
  const context = {
    route: async () => {},
    newPage: async () => {
      calls.pages += 1;
      return page;
    },
    close: async () => {},
  };
  const browser = {
    newContext: async () => {
      calls.contexts += 1;
      return context;
    },
    close: async () => {},
  };
  const fetcher = createForumFetcher({
    mode: 'browser',
    requestGapMs: 0,
    launchBrowser: async () => {
      calls.launches += 1;
      return browser;
    },
    fetchImpl: async () => {
      calls.http += 1;
      return { ok: true, text: async () => 'paste' };
    },
  });
  await fetcher.fetchText('https://www.smogon.com/forums/threads/a.1/');
  await fetcher.fetchText('https://www.smogon.com/forums/threads/b.2/');
  assert.equal(await fetcher.fetchText('https://pokepast.es/abc/raw'), 'paste');
  assert.deepEqual(calls, { launches: 1, contexts: 1, pages: 2, http: 1 });
  await fetcher.close();
  assert.equal(isSmogonForumUrl('https://www.smogon.com/forums/'), true);
  assert.equal(isSmogonForumUrl('https://www.smogon.com/dex/sm/'), false);
});

test('forum fetch: browser HTTP failures retain status and final URL',
  async () => {
    let pages = 0;
    const page = {
      goto: async () => ({
        status: () => 403,
        url: () => 'https://www.smogon.com/forums/blocked',
      }),
      close: async () => {},
    };
    const context = {
      route: async () => {},
      newPage: async () => {
        pages += 1;
        return page;
      },
      close: async () => {},
    };
    const browser = {
      newContext: async () => context,
      close: async () => {},
    };
    const fetcher = createForumFetcher({
      mode: 'browser',
      requestGapMs: 0,
      launchBrowser: async () => browser,
    });
    await assert.rejects(
      fetcher.fetchText('https://www.smogon.com/forums/threads/x.1/'),
      /403 https:\/\/www\.smogon\.com\/forums\/blocked/,
    );
    // A single URL's 403 is its own permission wall, not a block: retrying
    // it, and trying one other URL, both really fetch.
    await assert.rejects(
      fetcher.fetchText('https://www.smogon.com/forums/threads/x.1/'),
      /403 https:\/\/www\.smogon\.com\/forums\/blocked/,
    );
    assert.equal(pages, 2);
    await assert.rejects(
      fetcher.fetchText('https://www.smogon.com/forums/threads/y.2/'),
      /403 https:\/\/www\.smogon\.com\/forums\/blocked/,
    );
    assert.equal(pages, 3);
    // The second DISTINCT 403ing URL confirms a real block; from here the
    // latch pauses every Smogon request without fetching.
    await assert.rejects(
      fetcher.fetchText('https://www.smogon.com/forums/threads/z.3/'),
      /requests paused after 403/,
    );
    assert.equal(pages, 3);
    await fetcher.close();
  });


test('a torn tail cannot weld the next append into one lost line', () => {
  // A kill mid-append left no trailing newline; the re-append after restart
  // used to merge with the torn tail, silently losing the record for every
  // future reader.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-jsonl-torn-'));
  const file = path.join(dir, 'rmt-gen7ou.jsonl');
  fs.writeFileSync(file, '{"id":"a","sets":["ok"]}\n{"id":"b","se');
  const latest = readJsonlLatest(file);
  assert.equal(appendJsonlRecord(file, { id: 'b', sets: ['ok'] }, latest), true);
  assert.deepEqual(readJsonlLatest(file).get('b'), { id: 'b', sets: ['ok'] });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a deterministically teamless thread defers without freezing the cursor', () => {
  // An image-only RMT (short OP, no qualifying paste) used to leave the
  // thread unrecorded and break the walk before the listing cursor advanced,
  // wedging the backfill on that page forever.
  const state = readCrawlState(path.join(os.tmpdir(), 'no-such-state.json'));
  const listing = 'https://example.test/forums/x.1/';
  const progress = forListing(state, listing);
  const row = { threadId: '42', url: 'https://example.test/threads/img.42/', updatedAt: 7 };
  recordDeferredThread(state, row, progress.sweep);
  assert.equal(recordListingPage(state, listing, 1, true), true);
  assert.equal(forListing(state, listing).page, 2);
  // Deferred threads stay eligible for a retry on every later run.
  assert.equal(shouldScanThread(state.threads['42'], row, progress.sweep), true);
});
