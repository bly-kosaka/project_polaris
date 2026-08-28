import type { SourceIpAggregation } from '../aggregation/types.js';
import { countOf, sumStatusClass } from './axis-helpers.js';
import type { AxisDefinition } from './select-groups.js';
import { selectGroups, type SelectGroupsResult } from './select-groups.js';
import type { CandidateSelectionConfig } from './types.js';

/**
 * Request Count, Distinct Path, 4xx, 5xx, POST — Known Information doesn't
 * apply here since Known Information targets Path only (28 §19), and a
 * Source IP group carries no direct path-level annotation of its own.
 */
export function selectSourceIpGroups(
  sourceIps: SourceIpAggregation[],
  config: CandidateSelectionConfig,
): SelectGroupsResult<SourceIpAggregation> {
  const axes: AxisDefinition<SourceIpAggregation>[] = [
    { reason: 'request_count', limit: config.requestCountLimit, score: (s) => s.requestCount },
    {
      reason: 'distinct_path',
      limit: config.distinctPathLimit,
      score: (s) => (s.distinctPathCount > 0 ? s.distinctPathCount : undefined),
    },
    {
      reason: 'status_4xx',
      limit: config.clientErrorLimit,
      score: (s) => sumStatusClass(s.statusDistribution, 400, 499),
    },
    {
      reason: 'status_5xx',
      limit: config.serverErrorLimit,
      score: (s) => sumStatusClass(s.statusDistribution, 500, 599),
    },
    { reason: 'method_post', limit: config.postLimit, score: (s) => countOf(s.methodDistribution, 'POST') },
  ];

  return selectGroups(
    sourceIps,
    (s) => s.sourceIp,
    (s) => s.requestCount,
    axes,
    config.representativeLimit,
    config.sourceIpTotalLimit,
  );
}
