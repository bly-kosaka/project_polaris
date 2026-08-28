import type { MethodAggregation, StatusAggregation } from '../aggregation/types.js';
import { keepAllUpToLimit, type KeepAllResult } from './keep-all-up-to-limit.js';
import type { CandidateSelectionConfig } from './types.js';

export function selectStatusGroups(
  statuses: StatusAggregation[],
  config: CandidateSelectionConfig,
): KeepAllResult<StatusAggregation> {
  return keepAllUpToLimit(
    statuses,
    (s) => s.requestCount,
    (s) => String(s.status),
    config.statusTotalLimit,
  );
}

export function selectMethodGroups(
  methods: MethodAggregation[],
  config: CandidateSelectionConfig,
): KeepAllResult<MethodAggregation> {
  return keepAllUpToLimit(methods, (m) => m.requestCount, (m) => m.method, config.methodTotalLimit);
}
