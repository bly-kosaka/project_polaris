import type { AggregationSet } from '../aggregation/types.js';
import type { ParseSummary } from '../types/parse-summary.js';
import type { ObservationOverview } from './types.js';

export function buildOverview(aggregationSet: AggregationSet, parseSummary: ParseSummary): ObservationOverview {
  return {
    totalRequests: aggregationSet.overview.totalRequests,
    parsedRequests: parseSummary.parsedLines,
    partialRequests: parseSummary.partialLines,
    failedRequests: parseSummary.failedLines,
    distinctSourceIps: aggregationSet.overview.distinctSourceIps,
    distinctPaths: aggregationSet.overview.distinctPaths,
    distinctUserAgents: aggregationSet.overview.distinctUserAgents,
    firstSeen: aggregationSet.overview.firstSeen,
    lastSeen: aggregationSet.overview.lastSeen,
    totalResponseBytes: aggregationSet.overview.totalResponseBytes,
    statusDistribution: aggregationSet.overview.statusDistribution,
    methodDistribution: aggregationSet.overview.methodDistribution,
  };
}
