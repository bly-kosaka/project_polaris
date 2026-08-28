import { describe, expect, it } from 'vitest';
import type { TimeBucketAggregation } from '../aggregation/types.js';
import { selectFiveMinuteBuckets, selectOneMinuteBuckets } from '../selection/select-time-buckets.js';
import { DEFAULT_CANDIDATE_SELECTION_CONFIG } from '../selection/types.js';

function bucket(bucketStart: string, requestCount: number): TimeBucketAggregation {
  return {
    bucketStart,
    requestCount,
    distinctSourceIpCount: 1,
    distinctPathCount: 1,
    methodDistribution: [],
    statusDistribution: [],
    topPaths: [],
    topSourceIps: [],
  };
}

describe('1m / 5m time bucket truncation independence', () => {
  it('truncates 1-minute buckets without affecting 5-minute bucket availability', () => {
    // 200 one-minute buckets (a long log), but only 20 five-minute buckets for the same span.
    const oneMinuteBuckets = Array.from({ length: 200 }, (_, i) =>
      bucket(new Date(Date.UTC(2023, 9, 10, 0, i)).toISOString(), 1),
    );
    const fiveMinuteBuckets = Array.from({ length: 20 }, (_, i) =>
      bucket(new Date(Date.UTC(2023, 9, 10, 0, i * 5)).toISOString(), 5),
    );

    const config = { ...DEFAULT_CANDIDATE_SELECTION_CONFIG, time1mLimit: 50, time5mLimit: 120 };
    const oneMinuteResult = selectOneMinuteBuckets(oneMinuteBuckets, config);
    const fiveMinuteResult = selectFiveMinuteBuckets(fiveMinuteBuckets, config);

    expect(oneMinuteResult.truncation.omittedGroups).toBe(150);
    // 5-minute resolution is fully preserved even though 1-minute was truncated.
    expect(fiveMinuteResult.truncation.omittedGroups).toBe(0);
    expect(fiveMinuteResult.kept).toHaveLength(20);
  });

  it('each resolution honors its own configured limit independently', () => {
    const oneMinuteBuckets = Array.from({ length: 10 }, (_, i) => bucket(`b1-${i}`, i));
    const fiveMinuteBuckets = Array.from({ length: 10 }, (_, i) => bucket(`b5-${i}`, i));

    const config = { ...DEFAULT_CANDIDATE_SELECTION_CONFIG, time1mLimit: 3, time5mLimit: 7 };
    expect(selectOneMinuteBuckets(oneMinuteBuckets, config).kept).toHaveLength(3);
    expect(selectFiveMinuteBuckets(fiveMinuteBuckets, config).kept).toHaveLength(7);
  });
});
