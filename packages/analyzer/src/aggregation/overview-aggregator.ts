import type { NormalizedAccessLogEntry } from '../types/normalized-entry.js';
import { increment, toSortedCountArray } from './count-map.js';
import type { AggregationSet } from './types.js';

export class OverviewAggregator {
  private totalRequests = 0;
  private readonly sourceIps = new Set<string>();
  private readonly paths = new Set<string>();
  private readonly userAgents = new Set<string>();
  private firstSeen: string | null = null;
  private lastSeen: string | null = null;
  private totalResponseBytes: number | null = null;
  private readonly statusCounts = new Map<number, number>();
  private readonly methodCounts = new Map<string, number>();

  consume(entry: NormalizedAccessLogEntry): void {
    this.totalRequests += 1;
    if (entry.sourceIp !== undefined) this.sourceIps.add(entry.sourceIp);
    if (entry.path !== undefined) this.paths.add(entry.path);
    if (entry.userAgent !== undefined) this.userAgents.add(entry.userAgent);
    if (entry.status !== undefined) increment(this.statusCounts, entry.status);
    if (entry.method !== undefined) increment(this.methodCounts, entry.method);
    if (entry.responseBytes !== undefined) {
      this.totalResponseBytes = (this.totalResponseBytes ?? 0) + entry.responseBytes;
    }
    if (entry.timestamp !== undefined) {
      if (this.firstSeen === null || entry.timestamp < this.firstSeen) this.firstSeen = entry.timestamp;
      if (this.lastSeen === null || entry.timestamp > this.lastSeen) this.lastSeen = entry.timestamp;
    }
  }

  finalize(): AggregationSet['overview'] {
    return {
      totalRequests: this.totalRequests,
      distinctSourceIps: this.sourceIps.size,
      distinctPaths: this.paths.size,
      distinctUserAgents: this.userAgents.size,
      firstSeen: this.firstSeen,
      lastSeen: this.lastSeen,
      totalResponseBytes: this.totalResponseBytes,
      statusDistribution: toSortedCountArray(this.statusCounts),
      methodDistribution: toSortedCountArray(this.methodCounts),
    };
  }
}
