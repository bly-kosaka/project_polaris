import type { NormalizedAccessLogEntry } from '../types/normalized-entry.js';
import { increment } from './count-map.js';
import type { MethodAggregation, RankedCount, StatusAggregation } from './types.js';

interface MutableKeyedState<K> {
  key: K;
  requestCount: number;
  paths: Set<string>;
  pathCounts: Map<string, number>;
  sourceIps: Set<string>;
  sourceIpCounts: Map<string, number>;
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
 * Status and Method views are structurally identical (key + requestCount +
 * top paths/IPs) — one generic implementation backs both
 * (28_Development_Setup_and_Second_Sprint.md §12-13: neither carries any
 * semantic mapping like "404 = Warning" or "POST = dangerous").
 */
class KeyedAggregator<K extends string | number> {
  private readonly states = new Map<K, MutableKeyedState<K>>();

  constructor(
    private readonly extractKey: (entry: NormalizedAccessLogEntry) => K | undefined,
    private readonly topLimit: number,
  ) {}

  consume(entry: NormalizedAccessLogEntry): void {
    const key = this.extractKey(entry);
    if (key === undefined) return;

    let state = this.states.get(key);
    if (!state) {
      state = {
        key,
        requestCount: 0,
        paths: new Set(),
        pathCounts: new Map(),
        sourceIps: new Set(),
        sourceIpCounts: new Map(),
        firstSeen: null,
        lastSeen: null,
      };
      this.states.set(key, state);
    }

    state.requestCount += 1;
    if (entry.path !== undefined) {
      state.paths.add(entry.path);
      increment(state.pathCounts, entry.path);
    }
    if (entry.sourceIp !== undefined) {
      state.sourceIps.add(entry.sourceIp);
      increment(state.sourceIpCounts, entry.sourceIp);
    }
    if (entry.timestamp !== undefined) {
      if (state.firstSeen === null || entry.timestamp < state.firstSeen) state.firstSeen = entry.timestamp;
      if (state.lastSeen === null || entry.timestamp > state.lastSeen) state.lastSeen = entry.timestamp;
    }
  }

  finalizeStates(): MutableKeyedState<K>[] {
    return Array.from(this.states.values()).sort((a, b) => b.requestCount - a.requestCount);
  }

  buildCommonFields(state: MutableKeyedState<K>) {
    return {
      requestCount: state.requestCount,
      distinctPathCount: state.paths.size,
      distinctSourceIpCount: state.sourceIps.size,
      topPaths: topN(state.pathCounts, this.topLimit),
      topSourceIps: topN(state.sourceIpCounts, this.topLimit),
      firstSeen: state.firstSeen,
      lastSeen: state.lastSeen,
    };
  }
}

export class StatusAggregator {
  private readonly inner: KeyedAggregator<number>;

  constructor(topLimit: number) {
    this.inner = new KeyedAggregator<number>((entry) => entry.status, topLimit);
  }

  consume(entry: NormalizedAccessLogEntry): void {
    this.inner.consume(entry);
  }

  finalize(): StatusAggregation[] {
    return this.inner
      .finalizeStates()
      .map((state) => ({ status: state.key, ...this.inner.buildCommonFields(state) }));
  }
}

export class MethodAggregator {
  private readonly inner: KeyedAggregator<string>;

  constructor(topLimit: number) {
    this.inner = new KeyedAggregator<string>((entry) => entry.method, topLimit);
  }

  consume(entry: NormalizedAccessLogEntry): void {
    this.inner.consume(entry);
  }

  finalize(): MethodAggregation[] {
    return this.inner
      .finalizeStates()
      .map((state) => ({ method: state.key, ...this.inner.buildCommonFields(state) }));
  }
}
