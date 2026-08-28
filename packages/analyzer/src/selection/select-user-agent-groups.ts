import type { UserAgentAggregation } from '../aggregation/types.js';
import type { AxisDefinition } from './select-groups.js';
import { selectGroups, type SelectGroupsResult } from './select-groups.js';
import type { CandidateSelectionConfig } from './types.js';

/** Request Count, Distinct Path, Distinct Source IP — per 08 §14 min fields. */
export function selectUserAgentGroups(
  userAgents: UserAgentAggregation[],
  config: CandidateSelectionConfig,
): SelectGroupsResult<UserAgentAggregation> {
  const axes: AxisDefinition<UserAgentAggregation>[] = [
    { reason: 'request_count', limit: config.requestCountLimit, score: (u) => u.requestCount },
    {
      reason: 'distinct_path',
      limit: config.distinctPathLimit,
      score: (u) => (u.distinctPathCount > 0 ? u.distinctPathCount : undefined),
    },
    {
      reason: 'distinct_source_ip',
      limit: config.distinctSourceIpLimit,
      score: (u) => (u.distinctSourceIpCount > 0 ? u.distinctSourceIpCount : undefined),
    },
  ];

  return selectGroups(
    userAgents,
    (u) => u.userAgent,
    (u) => u.requestCount,
    axes,
    config.representativeLimit,
    config.userAgentTotalLimit,
  );
}
