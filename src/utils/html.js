/**
 * @param {*} value
 * @return {string}
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Attribute values need the same escaping as text content; kept as a named
 * alias so call sites read clearly at the point of use.
 * @const
 */
export const escapeAttr = escapeHtml;

/**
 * @param {boolean} isCurrent Whether a tab or link is the one being shown.
 * @return {string} The attribute that says so to assistive technology,
 *     with its leading space; '' otherwise. The tab's own styling says it
 *     to the eye.
 */
export function currentAttr(isCurrent) {
  return isCurrent ? ' aria-current="page"' : '';
}

/**
 * @param {boolean} isSorted Whether a table is sorted by this column.
 * @param {string} direction "asc" or "desc".
 * @return {string} The header cell's aria-sort attribute, with its leading
 *     space; '' for a column the table is not sorted by.
 */
export function sortAttr(isSorted, direction) {
  if (!isSorted) return '';
  return ` aria-sort="${direction === 'asc' ? 'ascending' : 'descending'}"`;
}
