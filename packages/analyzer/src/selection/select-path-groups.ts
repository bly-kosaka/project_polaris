import type { PathAggregation } from '../aggregation/types.js';
import { countOf, sumStatusClass } from './axis-helpers.js';
import type { AxisDefinition } from './select-groups.js';
import { selectGroups, type SelectGroupsResult } from './select-groups.js';
import type { CandidateSelectionConfig } from './types.js';

/** 7 axes per 08 §18.3: Known Information, Request Count, Distinct Source IP, 4xx, 5xx, POST, Response Size. */
export function selectPathGroups(
  paths: PathAggregation[],
  config: CandidateSelectionConfig,
): SelectGroupsResult<PathAggregation> {
  const axes: AxisDefinition<PathAggregation>[] = [
    {
      reason: 'known_information',
      limit: config.knownInformationLimit,
      score: (p) => (p.knownInformation.length > 0 ? p.requestCount : undefined),
    },
    { reason: 'request_count', limit: config.requestCountLimit, score: (p) => p.requestCount },
    {
      reason: 'distinct_source_ip',
      limit: config.distinctSourceIpLimit,
      score: (p) => (p.distinctSourceIpCount > 0 ? p.distinctSourceIpCount : undefined),
    },
    {
      reason: 'status_4xx',
      limit: config.clientErrorLimit,
      score: (p) => sumStatusClass(p.statusDistribution, 400, 499),
    },
    {
      reason: 'status_5xx',
      limit: config.serverErrorLimit,
      score: (p) => sumStatusClass(p.statusDistribution, 500, 599),
    },
    { reason: 'method_post', limit: config.postLimit, score: (p) => countOf(p.methodDistribution, 'POST') },
    {
      reason: 'response_size',
      limit: config.responseSizeLimit,
      score: (p) => (p.responseSize.count > 0 ? p.responseSize.total : undefined),
    },
  ];

  return selectGroups(
    paths,
    (p) => p.path,
    (p) => p.requestCount,
    axes,
    config.representativeLimit,
    config.pathTotalLimit,
  );
}
