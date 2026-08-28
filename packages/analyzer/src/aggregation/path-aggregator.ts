import type { NormalizedAccessLogEntry } from '../types/normalized-entry.js';
import { increment, toSortedCountArray } from './count-map.js';
import { FirstNSample } from './first-n-sample.js';
import { extractReferrerHost } from './referrer-host.js';
import { ResponseSizeAccumulator } from './response-size-summary.js';
import { floorToBucketIso, toSortedTimeBucketCounts } from './time-bucket.js';
import type { AggregationConfig, PathAggregation } from './types.js';

const TIME_DISTRIBUTION_BUCKET_MINUTES = 5;

interface MutablePathState {
  path: string;
  requestCount: number;
  sourceIps: Set<string>;
  userAgents: Set<string>;
  queries: Set<string>;
  methodCounts: Map<string, number>;
  statusCounts: Map<number, number>;
  referrerHostCounts: Map<string, number>;
  responseSize: ResponseSizeAccumulator;
  firstSeen: string | null;
  lastSeen: string | null;
  timeCounts: Map<string, number>;
  sampleSourceIps: FirstNSample<string>;
  sampleQueries: FirstNSample<string>;
  sampleReferrers: FirstNSample<string>;
}

export class PathAggregator {
  private readonly states = new Map<string, MutablePathState>();

  constructor(private readonly config: AggregationConfig) {}

  consume(entry: NormalizedAccessLogEntry): void {
    if (entry.path === undefined) return;

    let state = this.states.get(entry.path);
    if (!state) {
      state = {
        path: entry.path,
        requestCount: 0,
        sourceIps: new Set(),
        userAgents: new Set(),
        queries: new Set(),
        methodCounts: new Map(),
        statusCounts: new Map(),
        referrerHostCounts: new Map(),
        responseSize: new ResponseSizeAccumulator(),
        firstSeen: null,
        lastSeen: null,
        timeCounts: new Map(),
        sampleSourceIps: new FirstNSample(this.config.sampleLimit),
        sampleQueries: new FirstNSample(this.config.sampleLimit),
        sampleReferrers: new FirstNSample(this.config.sampleLimit),
      };
      this.states.set(entry.path, state);
    }

    state.requestCount += 1;
    if (entry.sourceIp !== undefined) {
      state.sourceIps.add(entry.sourceIp);
      state.sampleSourceIps.add(entry.sourceIp);
    }
    if (entry.userAgent !== undefined) state.userAgents.add(entry.userAgent);
    if (entry.query !== undefined) {
      state.queries.add(entry.query);
      state.sampleQueries.add(entry.query);
    }
    if (entry.method !== undefined) increment(state.methodCounts, entry.method);
    if (entry.status !== undefined) increment(state.statusCounts, entry.status);
    if (entry.referrer !== undefined) {
      increment(state.referrerHostCounts, extractReferrerHost(entry.referrer));
      state.sampleReferrers.add(entry.referrer);
    }
    if (entry.responseBytes !== undefined) state.responseSize.add(entry.responseBytes);
    if (entry.timestamp !== undefined) {
      if (state.firstSeen === null || entry.timestamp < state.firstSeen) state.firstSeen = entry.timestamp;
      if (state.lastSeen === null || entry.timestamp > state.lastSeen) state.lastSeen = entry.timestamp;
      increment(state.timeCounts, floorToBucketIso(entry.timestamp, TIME_DISTRIBUTION_BUCKET_MINUTES));
    }
  }

  finalize(): PathAggregation[] {
    return Array.from(this.states.values())
      .map(
        (state): PathAggregation => ({
          path: state.path,
          requestCount: state.requestCount,
          distinctSourceIpCount: state.sourceIps.size,
          distinctUserAgentCount: state.userAgents.size,
          queryVariantCount: state.queries.size,
          methodDistribution: toSortedCountArray(state.methodCounts),
          statusDistribution: toSortedCountArray(state.statusCounts),
          referrerHostDistribution: toSortedCountArray(state.referrerHostCounts),
          responseSize: state.responseSize.build(),
          firstSeen: state.firstSeen,
          lastSeen: state.lastSeen,
          timeDistribution: toSortedTimeBucketCounts(state.timeCounts),
          sampleSourceIps: state.sampleSourceIps.values(),
          sampleQueries: state.sampleQueries.values(),
          sampleReferrers: state.sampleReferrers.values(),
          knownInformation: [],
        }),
      )
      .sort((a, b) => b.requestCount - a.requestCount || (a.path < b.path ? -1 : 1));
  }
}
