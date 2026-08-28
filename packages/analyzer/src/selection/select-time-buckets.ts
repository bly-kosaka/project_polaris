import type { TimeBucketAggregation } from '../aggregation/types.js';
import { keepAllUpToLimit, type KeepAllResult } from './keep-all-up-to-limit.js';
import type { CandidateSelectionConfig } from './types.js';

/** 1m and 5m are each kept up to their OWN limit — never "prefer 5m, drop 1m" (28 §15.1). */
export function selectOneMinuteBuckets(
  buckets: TimeBucketAggregation[],
  config: CandidateSelectionConfig,
): KeepAllResult<TimeBucketAggregation> {
  return keepAllUpToLimit(buckets, (b) => b.requestCount, (b) => b.bucketStart, config.time1mLimit);
}

export function selectFiveMinuteBuckets(
  buckets: TimeBucketAggregation[],
  config: CandidateSelectionConfig,
): KeepAllResult<TimeBucketAggregation> {
  return keepAllUpToLimit(buckets, (b) => b.requestCount, (b) => b.bucketStart, config.time5mLimit);
}
