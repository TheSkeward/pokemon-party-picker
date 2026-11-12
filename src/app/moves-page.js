import {
  renderMoveUsageControls,
  renderMoveUsageTable,
} from '../views/move-usage-view';

/**
 * Renders the Move Usage page (controls, move table) into `pageRoot`,
 * replacing its contents.
 * @param {!Element} pageRoot
 * @param {{familyLabel: string, moveUsage: ?Object, state: !Object}} context
 *     `moveUsage` is the family's move usage table, null when it has none.
 */
export function renderMovesPage(pageRoot, context) {
  const { familyLabel, moveUsage, state } = context;

  pageRoot.innerHTML = `
    <section id="move-controls-root"></section>
    <main id="move-content-root"></main>
  `;

  renderMoveUsageControls(
    document.querySelector('#move-controls-root'),
    state,
  );

  renderMoveUsageTable(
    document.querySelector('#move-content-root'),
    moveUsage,
    state,
    { familyLabel },
  );
}
