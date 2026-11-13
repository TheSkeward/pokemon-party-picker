/**
 * @fileoverview Persists the team-optimizer's Layer-3 result memo across page
 * loads, so a reload (to pick up a deploy, restore a tab, or recover from a
 * crash) restores a previously-computed pool instantly instead of paying the
 * line-resolution and search cost again.
 *
 * IndexedDB (not localStorage) because a result holds the full resolved-lines
 * graph and bench-swap Map — that's structured-clone-friendly and can exceed
 * localStorage's ~5MB cap on exactly the big pools this is meant to help.
 * Every operation degrades silently to a no-op if IndexedDB is unavailable,
 * the data isn't cloneable, or the quota is exceeded: persistence is a cache,
 * never a source of truth, so a failure just falls back to recomputing.
 *
 * The record key must stay short. LevelDB copies record keys into its
 * manifest on every flush and compaction, so a 2 MB key grew one manifest to
 * 13 GB in a day; the optimizer keys on a digest of the score context
 * (test/result-cache-key.test.mjs bounds the length).
 *
 * A record is read only when its pool asks for it. Each holds a whole
 * resolved pool, so reading the store through at startup, as this once
 * did, put every cached gamestate in memory for the life of the tab.
 */

// Frozen at the project's original name; renaming would orphan every
// browser's existing cache for no gain.
const DB_NAME = 'pokemon-usage-viewer';
const STORE = 'team-results';
// 2 adds the index by version, which lets retired records be found
// without reading them.
const DB_VERSION = 2;
// Cap stored pools so the database can't grow without bound; oldest-written are
// evicted first. Sized for the investment plan's future-cap projections, which
// persist alongside the interactive result: each gamestate can write three
// records (now + two "search:fast" future caps), so 60 keeps ~20 gamestates.
const MAX_ENTRIES = 60;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = typeof indexedDB === 'undefined'
    ? Promise.resolve(null)
    : openStore();
  return dbPromise;
}

function openStore() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains(STORE)
          ? request.transaction.objectStore(STORE)
          : db.createObjectStore(STORE, { keyPath: 'poolKey' });
        if (!store.indexNames.contains('ts')) store.createIndex('ts', 'ts');
        if (!store.indexNames.contains('version')) {
          store.createIndex('version', 'version');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        // Step aside for a newer build in another tab that needs to
        // upgrade the store; this tab then simply stops caching.
        db.onversionchange = () => {
          db.close();
          dbPromise = Promise.resolve(null);
        };
        resolve(db);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * The result persisted for one pool under the current version, if any. The
 * first call also retires, in the background, the records of other
 * versions (a deploy that changed optimizer output bumps the version).
 * @param {string} version
 * @param {string} poolKey
 * @return {Promise<?Object>} The result; null when there is none.
 */
export async function loadPersistedResult(version, poolKey) {
  const db = await openDb();
  if (!db) return null;
  pruneOtherVersions(db, version);

  return new Promise((resolve) => {
    try {
      const request =
        db.transaction(STORE, 'readonly').objectStore(STORE).get(poolKey);
      request.onsuccess = () => {
        const value = request.result;
        resolve(value?.version === version && value.result
          ? value.result
          : null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// Deletes the records of every version but this one, once a session. A key
// cursor over the version index names them without reading a record.
let pruned = false;
function pruneOtherVersions(db, version) {
  if (pruned) return;
  pruned = true;
  try {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    const request = store.index('version').openKeyCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (cursor.key !== version) store.delete(cursor.primaryKey);
      cursor.continue();
    };
  } catch {
    // best-effort cleanup
  }
}

/**
 * Write-through a single result. Fire-and-forget: callers don't await it.
 * @param {string} version
 * @param {string} poolKey
 * @param {Object} result
 */
export async function persistResult(version, poolKey, result) {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    // put() structured-clones synchronously and throws DataCloneError here if
    // the result isn't cloneable, so the catch keeps a bad entry from breaking
    // writes. Quota errors are different: IndexedDB delivers those via the
    // request/transaction ERROR EVENTS after this block exits, so without
    // handlers they surface as unhandled error events in the console. Swallow
    // them — persistence is best-effort by design.
    const putRequest = store.put({ poolKey, version, result, ts: Date.now() });
    putRequest.onerror = (event) => event.preventDefault();
    tx.onabort = () => {};
    tx.onerror = (event) => event.preventDefault();
    const countRequest = store.count();
    countRequest.onsuccess = () => {
      const overflow = countRequest.result - MAX_ENTRIES;
      if (overflow > 0) evictOldest(store, overflow);
    };
  } catch {
    // Non-cloneable result or synchronous transaction failure — skip.
  }
}

function evictOldest(store, count) {
  try {
    const request = store.index('ts').openCursor();
    let removed = 0;
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || removed >= count) return;
      cursor.delete();
      removed += 1;
      cursor.continue();
    };
  } catch {
    // best-effort eviction
  }
}

