import type { NormalizedAccessLogEntry } from '../types/normalized-entry.js';
import { increment, toSortedCountArray } from './count-map.js';
import type { AggregationConfig, RankedCount, UserAgentAggregation } from './types.js';

interface MutableUserAgentState {
  userAgent: string;
  requestCount: number;
  paths: Set<string>;
  pathCounts: Map<string, number>;
  sourceIps: Set<string>;
  methodCounts: Map<string, number>;
  statusCounts: Map<number, number>;
  firstSeen: string | null;
  lastSeen: string | null;
}

function topN(counts: Map<string, number>, limit: number): RankedCount<string>[] {
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : 1))
    .slice(0, limit);
}

/**
 * The raw User-Agent string is the aggregation key as-is — no
 * browser/bot/crawler classification (28_Development_Setup_and_Second_Sprint.md §14).
 */
export class UserAgentAggregator {
  private readonly states = new Map<string, MutableUserAgentState>();

  constructor(private readonly config: AggregationConfig) {}

  consume(entry: NormalizedAccessLogEntry): void {
    if (entry.userAgent === undefined) return;

    let state = this.states.get(entry.userAgent);
    if (!state) {
      state = {
        userAgent: entry.userAgent,
        requestCount: 0,
        paths: new Set(),
        pathCounts: new Map(),
        sourceIps: new Set(),
        methodCounts: new Map(),
        statusCounts: new Map(),
        firstSeen: null,
        lastSeen: null,
      };
      this.states.set(entry.userAgent, state);
    }

    state.requestCount += 1;
    if (entry.path !== undefined) {
      state.paths.add(entry.path);
      increment(state.pathCounts, entry.path);
    }
    if (entry.sourceIp !== undefined) state.sourceIps.add(entry.sourceIp);
    if (entry.method !== undefined) increment(state.methodCounts, entry.method);
    if (entry.status !== undefined) increment(state.statusCounts, entry.status);
    if (entry.timestamp !== undefined) {
      if (state.firstSeen === null || entry.timestamp < state.firstSeen) state.firstSeen = entry.timestamp;
      if (state.lastSeen === null || entry.timestamp > state.lastSeen) state.lastSeen = entry.timestamp;
    }
  }

  finalize(): UserAgentAggregation[] {
    return Array.from(this.states.values())
      .map(
        (state): UserAgentAggregation => ({
          userAgent: state.userAgent,
          requestCount: state.requestCount,
          distinctPathCount: state.paths.size,
          distinctSourceIpCount: state.sourceIps.size,
          methodDistribution: toSortedCountArray(state.methodCounts),
          statusDistribution: toSortedCountArray(state.statusCounts),
          topPaths: topN(state.pathCounts, this.config.topPathLimit),
          firstSeen: state.firstSeen,
          lastSeen: state.lastSeen,
        }),
      )
      .sort((a, b) => b.requestCount - a.requestCount || (a.userAgent < b.userAgent ? -1 : 1));
  }
}
