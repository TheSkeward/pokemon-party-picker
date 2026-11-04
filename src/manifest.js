/**
 * @fileoverview Loads the data-provenance manifest
 * (scripts/build-manifest.mjs). Used to fold the data signature into
 * optimizer cache keys and to show the user exactly which Reborn/data/scoring
 * versions produced a recommendation.
 */
import { dataUrl } from './utils/data-url.js';

import { setDataVersionTag } from './utils/data-url.js';

let manifestPromise = null;
let excluded = [];

/** @return {!Promise<?Object>} The manifest, or null when it fails to load. */
export function loadManifest() {
  if (!manifestPromise) {
    // no-store: the manifest is the freshness root — reading a CDN-stale
    // manifest would version every data fetch with the OLD signature and
    // pin the whole session to stale data (the Mawile incident).
    manifestPromise = fetch(dataUrl('manifest.json'), { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((manifest) => {
        if (manifest?.dataSignature) setDataVersionTag(manifest.dataSignature);
        excluded = Array.isArray(manifest?.excludedData)
          ? manifest.excludedData
          : [];
        return manifest;
      })
      .catch(() => null);
  }
  return manifestPromise;
}

/**
 * The data roots this deployment left out (DEPLOY_EXCLUDE_DATA at build
 * time), known once loadManifest has resolved; empty before that and for a
 * full checkout. The raw monthly sources are the one root a deployment
 * drops, and only single-month mode reads them.
 * @return {!Array<string>}
 */
export function excludedDataRoots() {
  return excluded;
}

/**
 * @return {!Promise<string>} The manifest's dataSignature, or 'unversioned'
 *     when the manifest is unavailable.
 */
export async function getDataSignature() {
  const manifest = await loadManifest();
  return manifest?.dataSignature || 'unversioned';
}
