import type { NormalizedAccessLogEntry } from '../types/normalized-entry.js';
import { increment, toSortedCountArray } from './count-map.js';
import { floorToBucketIso } from './time-bucket.js';
import type { AggregationConfig, RankedCount, TimeBucketAggregation } from './types.js';

interface MutableBucketState {
  bucketStart: string;
  requestCount: number;
  sourceIps: Set<string>;
  paths: Set<string>;
  pathCounts: Map<string, number>;
  sourceIpCounts: Map<string, number>;
  methodCounts: Map<string, number>;
  statusCounts: Map<number, number>;
}

function topN(counts: Map<string, number>, limit: number): RankedCount<string>[] {
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : 1))
    .slice(0, limit);
}

class SingleResolutionTimeAggregator {
  private readonly states = new Map<string, MutableBucketState>();

  constructor(
    private readonly bucketMinutes: number,
    private readonly config: AggregationConfig,
  ) {}

  consume(entry: NormalizedAccessLogEntry): void {
    if (entry.timestamp === undefined) return;

    const bucketStart = floorToBucketIso(entry.timestamp, this.bucketMinutes);
    let state = this.states.get(bucketStart);
    if (!state) {
      state = {
        bucketStart,
        requestCount: 0,
        sourceIps: new Set(),
        paths: new Set(),
        pathCounts: new Map(),
        sourceIpCounts: new Map(),
        methodCounts: new Map(),
        statusCounts: new Map(),
      };
      this.states.set(bucketStart, state);
    }

    state.requestCount += 1;
    if (entry.sourceIp !== undefined) {
      state.sourceIps.add(entry.sourceIp);
      increment(state.sourceIpCounts, entry.sourceIp);
    }
    if (entry.path !== undefined) {
      state.paths.add(entry.path);
      increment(state.pathCounts, entry.path);
    }
    if (entry.method !== undefined) increment(state.methodCounts, entry.method);
    if (entry.status !== undefined) increment(state.statusCounts, entry.status);
  }

  finalize(): TimeBucketAggregation[] {
    return Array.from(this.states.values())
      .map(
        (state): TimeBucketAggregation => ({
          bucketStart: state.bucketStart,
          requestCount: state.requestCount,
          distinctSourceIpCount: state.sourceIps.size,
          distinctPathCount: state.paths.size,
          methodDistribution: toSortedCountArray(state.methodCounts),
          statusDistribution: toSortedCountArray(state.statusCounts),
          topPaths: topN(state.pathCounts, this.config.topPathLimit),
          topSourceIps: topN(state.sourceIpCounts, this.config.topSourceIpLimit),
        }),
      )
      .sort((a, b) => (a.bucketStart < b.bucketStart ? -1 : a.bucketStart > b.bucketStart ? 1 : 0));
  }
}

/**
 * 1-minute and 5-minute buckets are independent resolutions, each consumed
 * and finalized separately — never one derived from the other, and never
 * one truncated at the expense of the other downstream
 * (28_Development_Setup_and_Second_Sprint.md §15.1).
 */
export class TimeAggregator {
  private readonly oneMinute: SingleResolutionTimeAggregator;
  private readonly fiveMinute: SingleResolutionTimeAggregator;

  constructor(config: AggregationConfig) {
    this.oneMinute = new SingleResolutionTimeAggregator(1, config);
    this.fiveMinute = new SingleResolutionTimeAggregator(5, config);
  }

  consume(entry: NormalizedAccessLogEntry): void {
    this.oneMinute.consume(entry);
    this.fiveMinute.consume(entry);
  }

  finalize(): { oneMinute: TimeBucketAggregation[]; fiveMinute: TimeBucketAggregation[] } {
    return { oneMinute: this.oneMinute.finalize(), fiveMinute: this.fiveMinute.finalize() };
  }
}
