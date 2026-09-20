/**
 * @fileoverview Shared driver for the forum listing scrapers: one walk over
 * a thread listing that combines a live head-page check with the
 * durable-cursor backfill loop, plus the per-run budget flags that bound
 * each harvest.
 */
import {
  forListing,
  recordEmptyListing,
  recordListingPage,
  saveCrawlState,
} from './crawl-state.mjs';
import { describeEmptyListing, listingPageUrl } from './forum-html.mjs';

/**
 * How long a listing seen empty stays unfetched. The empty forums are closed
 * archives, so a monthly look is plenty; a container forum (subforums, no
 * threads of its own) is never skipped, since its page is how the walker
 * discovers the subforums.
 * @const {number}
 */
export const EMPTY_LISTING_RECHECK_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * @param {{emptyAt: (string|undefined)}} progress A listing's crawl state.
 * @param {!Date=} now
 * @return {boolean} Whether the listing was seen empty recently enough to
 *     leave unfetched this run.
 */
export function skipsEmptyListing(progress, now = new Date()) {
  if (!progress.emptyAt) return false;
  const age = now.getTime() - Date.parse(progress.emptyAt);
  return age < EMPTY_LISTING_RECHECK_MS;
}

/**
 * Reads a `--<flag>=<count>` per-run budget from argv.
 * @param {!Array<string>} argv Process arguments.
 * @param {string} flag Flag name without the leading dashes, e.g. 'max-new'.
 * @param {number} fallback Budget when the flag is absent or unreadable.
 * @return {number}
 */
export function parseBudget(argv, flag, fallback) {
  const prefix = `--${flag}=`;
  const value = argv.find((arg) => arg.startsWith(prefix))?.split('=')[1];
  return Number(value) || fallback;
}

/**
 * Walks one forum listing within this run's budgets. The live first page is
 * always fetched and processed so newly created or recently active threads
 * are seen every run, independently of the historical backfill cursor. The
 * cursor then advances through at most listingPagesPerRun pages of the
 * current sweep, persisting crawl state after each handled page. An
 * unhandled page (processPage returned handled: false — the budget ran out
 * mid-page or a thread needs a retry) ends the walk without advancing the
 * cursor, and a sweep that wraps ends the walk rather than starting a
 * second sweep in the same run.
 *
 * @param {{
 *   listing: string,
 *   fetchText: function(string): !Promise<string>,
 *   processPage: function(string, number):
 *       !Promise<{handled: boolean, next: boolean}>,
 *   crawl: !Object,
 *   crawlFile: string,
 *   listingPagesPerRun: number,
 *   outOfBudget: function(): boolean,
 * }} options listing is the crawl-state key and page-URL base; processPage
 *     receives (html, pageNumber); outOfBudget reports whether this run's
 *     harvest budgets are exhausted.
 * @return {!Promise<void>}
 */
export async function walkListingPages({ listing, fetchText, processPage,
  crawl, crawlFile, listingPagesPerRun, outOfBudget }) {
  const progress = forListing(crawl, listing);
  if (skipsEmptyListing(progress)) {
    console.log(`listing ${listing}: empty since ${progress.emptyAt}, skipped`);
    return;
  }
  const headHtml = await fetchText(listingPageUrl(listing, 1));
  const head = await processPage(headHtml, 1);
  const empty = describeEmptyListing(headHtml);
  if (empty && !empty.subforums) {
    recordEmptyListing(crawl, listing);
    saveCrawlState(crawlFile, crawl);
    console.log(`listing ${listing}: no threads (empty forum), next look in a month`);
    return;
  }
  delete progress.emptyAt;
  if (!head.handled) return;
  let pages = 0;
  while (pages < listingPagesPerRun && !outOfBudget()) {
    const page = progress.page;
    const html = page === 1
      ? headHtml
      : await fetchText(listingPageUrl(listing, page));
    const result = page === 1 ? head : await processPage(html, page);
    if (!result.handled) return;
    const sweepContinues =
      recordListingPage(crawl, listing, page, result.next);
    saveCrawlState(crawlFile, crawl);
    pages += 1;
    if (!sweepContinues) return;
  }
}
