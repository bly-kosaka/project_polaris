import type { TimeBucketCount } from './types.js';

/** Floors an ISO timestamp down to the start of its N-minute bucket, returned as ISO. */
export function floorToBucketIso(timestampIso: string, bucketMinutes: number): string {
  const date = new Date(timestampIso);
  const bucketMs = bucketMinutes * 60 * 1000;
  const flooredMs = Math.floor(date.getTime() / bucketMs) * bucketMs;
  return new Date(flooredMs).toISOString();
}

export function toSortedTimeBucketCounts(map: Map<string, number>): TimeBucketCount[] {
  return Array.from(map.entries())
    .map(([bucketStart, count]) => ({ bucketStart, count }))
    .sort((a, b) => (a.bucketStart < b.bucketStart ? -1 : a.bucketStart > b.bucketStart ? 1 : 0));
}
