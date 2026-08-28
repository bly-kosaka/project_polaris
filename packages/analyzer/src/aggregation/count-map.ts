import type { CountMap } from './types.js';

export function increment<K>(map: Map<K, number>, key: K): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/**
 * Deterministic conversion of a Map's accumulated counts to a sorted array:
 * count desc, then key asc as a tiebreak — never raw Map iteration order
 * (28_Development_Setup_and_Second_Sprint.md §16, §49).
 */
export function toSortedCountArray<K>(map: Map<K, number>): CountMap<K> {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
