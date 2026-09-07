import type { ObservationSetDto } from '../api/schemas';

export type AggregationTabKey = 'path' | 'sourceIp' | 'status' | 'method' | 'userAgent' | 'time';

export interface ResolvedReference {
  tab: AggregationTabKey;
  searchValue: string;
}

/**
 * `groupId`'s dimension prefix (path:/source-ip:/source-ip-path:/status:/
 * method:/user-agent:/time:1m:/time:5m: — packages/analyzer/src/observation-set/group-id.ts)
 * picks the target tab with no scanning needed; only the value after the
 * prefix is hashed, so the display value still has to come from a scan of
 * that one already-loaded aggregation array (md/44 §72-73). `source-ip-path`
 * has no dedicated tab (Sprint 5 decision 9 — drill-down only), so it
 * resolves to the Path tab, matching a Finding's own most common evidence
 * shape (a specific path hit from a specific IP).
 */
export function resolveAiReference(observationSet: ObservationSetDto, groupId: string): ResolvedReference | null {
  if (groupId.startsWith('source-ip-path:')) {
    const row = observationSet.aggregations.sourceIpPaths.find((g) => g.groupId === groupId);
    return row ? { tab: 'path', searchValue: row.value.path } : null;
  }
  if (groupId.startsWith('path:')) {
    const row = observationSet.aggregations.paths.find((g) => g.groupId === groupId);
    return row ? { tab: 'path', searchValue: row.value.path } : null;
  }
  if (groupId.startsWith('source-ip:')) {
    const row = observationSet.aggregations.sourceIps.find((g) => g.groupId === groupId);
    return row ? { tab: 'sourceIp', searchValue: row.value.sourceIp } : null;
  }
  if (groupId.startsWith('status:')) {
    const row = observationSet.aggregations.statuses.find((g) => g.groupId === groupId);
    return row ? { tab: 'status', searchValue: String(row.value.status) } : null;
  }
  if (groupId.startsWith('method:')) {
    const row = observationSet.aggregations.methods.find((g) => g.groupId === groupId);
    return row ? { tab: 'method', searchValue: row.value.method } : null;
  }
  if (groupId.startsWith('user-agent:')) {
    const row = observationSet.aggregations.userAgents.find((g) => g.groupId === groupId);
    return row ? { tab: 'userAgent', searchValue: row.value.userAgent } : null;
  }
  if (groupId.startsWith('time:')) {
    const inOneMinute = observationSet.aggregations.time.oneMinute.some((g) => g.groupId === groupId);
    const inFiveMinute = inOneMinute ? true : observationSet.aggregations.time.fiveMinute.some((g) => g.groupId === groupId);
    return inOneMinute || inFiveMinute ? { tab: 'time', searchValue: '' } : null;
  }
  return null;
}
