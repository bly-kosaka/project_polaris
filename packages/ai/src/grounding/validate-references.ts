import type { ObservationSet } from '@polaris/analyzer';

/**
 * Every `groupId` that actually exists in this ObservationSet, across all
 * eight group arrays — the only thing a Reference is allowed to point at
 * (44_Development_Setup_and_Sixth_Sprint.md §19-20).
 */
export function collectObservationGroupIds(observationSet: ObservationSet): Set<string> {
  const groupIds = new Set<string>();
  const { aggregations } = observationSet;

  for (const group of aggregations.paths) groupIds.add(group.groupId);
  for (const group of aggregations.sourceIps) groupIds.add(group.groupId);
  for (const group of aggregations.sourceIpPaths) groupIds.add(group.groupId);
  for (const group of aggregations.statuses) groupIds.add(group.groupId);
  for (const group of aggregations.methods) groupIds.add(group.groupId);
  for (const group of aggregations.userAgents) groupIds.add(group.groupId);
  for (const group of aggregations.time.oneMinute) groupIds.add(group.groupId);
  for (const group of aggregations.time.fiveMinute) groupIds.add(group.groupId);

  return groupIds;
}
