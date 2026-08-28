import type { SourceIpPathAggregation } from '../aggregation/types.js';
import { countOf, sumStatusClass } from './axis-helpers.js';
import type { AxisDefinition } from './select-groups.js';
import { selectGroups, type SelectGroupsResult } from './select-groups.js';
import type { CandidateSelectionConfig } from './types.js';

const KEY_SEPARATOR = ' ';

/** Known Information, Request Count, 4xx, 5xx, POST — per 08 §11.4. */
export function selectSourceIpPathGroups(
  sourceIpPaths: SourceIpPathAggregation[],
  config: CandidateSelectionConfig,
): SelectGroupsResult<SourceIpPathAggregation> {
  const axes: AxisDefinition<SourceIpPathAggregation>[] = [
    {
      reason: 'known_information',
      limit: config.knownInformationLimit,
      score: (sp) => (sp.knownInformation.length > 0 ? sp.requestCount : undefined),
    },
    { reason: 'request_count', limit: config.requestCountLimit, score: (sp) => sp.requestCount },
    {
      reason: 'status_4xx',
      limit: config.clientErrorLimit,
      score: (sp) => sumStatusClass(sp.statusDistribution, 400, 499),
    },
    {
      reason: 'status_5xx',
      limit: config.serverErrorLimit,
      score: (sp) => sumStatusClass(sp.statusDistribution, 500, 599),
    },
    { reason: 'method_post', limit: config.postLimit, score: (sp) => countOf(sp.methodDistribution, 'POST') },
  ];

  return selectGroups(
    sourceIpPaths,
    (sp) => `${sp.sourceIp}${KEY_SEPARATOR}${sp.path}`,
    (sp) => sp.requestCount,
    axes,
    config.representativeLimit,
    config.sourceIpPathTotalLimit,
  );
}
