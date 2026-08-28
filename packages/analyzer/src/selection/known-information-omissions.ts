import type { PathAggregation } from '../aggregation/types.js';
import type { KnownInformationOmission } from '../truncation/types.js';
import type { SelectedGroup } from './types.js';

/**
 * Per-Known-Information-id omission counts, computed by comparing every
 * matched path (pre-selection) against which paths actually survived
 * selection — so a Known Information match that got squeezed out by the
 * total limit is still traceable, never a silent drop (08 §18.6).
 */
export function computeKnownInformationOmissions(
  annotatedPaths: PathAggregation[],
  selectedPaths: SelectedGroup<PathAggregation>[],
): KnownInformationOmission[] {
  const selectedPathKeys = new Set(selectedPaths.map((g) => g.value.path));
  const omittedByKnownInformationId = new Map<string, number>();

  for (const pathAggregation of annotatedPaths) {
    if (selectedPathKeys.has(pathAggregation.path)) continue;
    for (const match of pathAggregation.knownInformation) {
      omittedByKnownInformationId.set(match.id, (omittedByKnownInformationId.get(match.id) ?? 0) + 1);
    }
  }

  return Array.from(omittedByKnownInformationId.entries())
    .map(([knownInformationId, omittedGroupCount]) => ({ knownInformationId, omittedGroupCount }))
    .sort((a, b) => (a.knownInformationId < b.knownInformationId ? -1 : 1));
}
