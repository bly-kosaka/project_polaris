import type { SourceIpPathAggregation } from '../aggregation/types.js';
import type { SelectedGroup } from '../selection/types.js';
import type { ObservationReferenceSummary } from './types.js';

/**
 * Runs after selection is final — a reference is only attached when its
 * target group actually survived selection; an omitted group is never
 * resurrected just to satisfy a reference (28 §34, §36).
 */
export function resolveReferences(
  selectedSourceIpPaths: SelectedGroup<SourceIpPathAggregation>[],
  pathGroupIdByPath: Map<string, string>,
  sourceIpGroupIdBySourceIp: Map<string, string>,
): { resolved: SelectedGroup<SourceIpPathAggregation>[]; summary: ObservationReferenceSummary } {
  let resolvedPathRefs = 0;
  let unresolvedPathRefs = 0;
  let resolvedSourceIpRefs = 0;
  let unresolvedSourceIpRefs = 0;

  const resolved = selectedSourceIpPaths.map((group) => {
    const pathGroupId = pathGroupIdByPath.get(group.value.path);
    const sourceIpGroupId = sourceIpGroupIdBySourceIp.get(group.value.sourceIp);

    if (pathGroupId !== undefined) resolvedPathRefs += 1;
    else unresolvedPathRefs += 1;
    if (sourceIpGroupId !== undefined) resolvedSourceIpRefs += 1;
    else unresolvedSourceIpRefs += 1;

    return {
      ...group,
      value: {
        ...group.value,
        ...(pathGroupId !== undefined
          ? { pathGroupRef: { groupId: pathGroupId, groupType: 'path' as const } }
          : {}),
        ...(sourceIpGroupId !== undefined
          ? { sourceIpGroupRef: { groupId: sourceIpGroupId, groupType: 'source_ip' as const } }
          : {}),
      },
    };
  });

  return {
    resolved,
    summary: { resolvedPathRefs, resolvedSourceIpRefs, unresolvedPathRefs, unresolvedSourceIpRefs },
  };
}
