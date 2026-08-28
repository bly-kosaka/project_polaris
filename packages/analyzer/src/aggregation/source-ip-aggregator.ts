import type { NormalizedAccessLogEntry } from '../types/normalized-entry.js';
import { increment, toSortedCountArray } from './count-map.js';
import { ResponseSizeAccumulator } from './response-size-summary.js';
import { floorToBucketIso, toSortedTimeBucketCounts } from './time-bucket.js';
import type { AggregationConfig, RankedCount, SourceIpAggregation } from './types.js';

const TIME_DISTRIBUTION_BUCKET_MINUTES = 5;

interface MutableSourceIpState {
  sourceIp: string;
  requestCount: number;
  paths: Set<string>;
  pathCounts: Map<string, number>;
  userAgents: Set<string>;
  methodCounts: Map<string, number>;
  statusCounts: Map<number, number>;
  responseSize: ResponseSizeAccumulator;
  firstSeen: string | null;
  lastSeen: string | null;
  timeCounts: Map<string, number>;
}

function topN(counts: Map<string, number>, limit: number): RankedCount<string>[] {
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : 1))
    .slice(0, limit);
}

/**
 * An entry missing sourceIp is skipped entirely — never folded into an
 * "unknown" bucket (28_Development_Setup_and_Second_Sprint.md §10).
 */
export class SourceIpAggregator {
  private readonly states = new Map<string, MutableSourceIpState>();

  constructor(private readonly config: AggregationConfig) {}

  consume(entry: NormalizedAccessLogEntry): void {
    if (entry.sourceIp === undefined) return;

    let state = this.states.get(entry.sourceIp);
    if (!state) {
      state = {
        sourceIp: entry.sourceIp,
        requestCount: 0,
        paths: new Set(),
        pathCounts: new Map(),
        userAgents: new Set(),
        methodCounts: new Map(),
        statusCounts: new Map(),
        responseSize: new ResponseSizeAccumulator(),
        firstSeen: null,
        lastSeen: null,
        timeCounts: new Map(),
      };
      this.states.set(entry.sourceIp, state);
    }

    state.requestCount += 1;
    if (entry.path !== undefined) {
      state.paths.add(entry.path);
      increment(state.pathCounts, entry.path);
    }
    if (entry.userAgent !== undefined) state.userAgents.add(entry.userAgent);
    if (entry.method !== undefined) increment(state.methodCounts, entry.method);
    if (entry.status !== undefined) increment(state.statusCounts, entry.status);
    if (entry.responseBytes !== undefined) state.responseSize.add(entry.responseBytes);
    if (entry.timestamp !== undefined) {
      if (state.firstSeen === null || entry.timestamp < state.firstSeen) state.firstSeen = entry.timestamp;
      if (state.lastSeen === null || entry.timestamp > state.lastSeen) state.lastSeen = entry.timestamp;
      increment(state.timeCounts, floorToBucketIso(entry.timestamp, TIME_DISTRIBUTION_BUCKET_MINUTES));
    }
  }

  finalize(): SourceIpAggregation[] {
    return Array.from(this.states.values())
      .map(
        (state): SourceIpAggregation => ({
          sourceIp: state.sourceIp,
          requestCount: state.requestCount,
          distinctPathCount: state.paths.size,
          distinctUserAgentCount: state.userAgents.size,
          methodDistribution: toSortedCountArray(state.methodCounts),
          statusDistribution: toSortedCountArray(state.statusCounts),
          responseSize: state.responseSize.build(),
          firstSeen: state.firstSeen,
          lastSeen: state.lastSeen,
          timeDistribution: toSortedTimeBucketCounts(state.timeCounts),
          topPaths: topN(state.pathCounts, this.config.topPathLimit),
        }),
      )
      .sort((a, b) => b.requestCount - a.requestCount || (a.sourceIp < b.sourceIp ? -1 : 1));
  }
}
