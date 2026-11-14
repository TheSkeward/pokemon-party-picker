import {
  createPrecomputedSetDetailsLoader,
  describePrecomputedSetSource,
} from '../setDetails/precomputed-set-details.js';

/**
 * @param {{getFamily: function(): string, onUpdate: function(): void}} hooks
 * @return {Object} Precomputed set-details loader with `describeSource`
 *     attached.
 */
export function createTeamBuilderSetDetailsLoader({ getFamily, onUpdate }) {
  const loader = createPrecomputedSetDetailsLoader({ getFamily, onUpdate });

  return {
    ...loader,
    describeSource: describePrecomputedSetSource,
  };
}
