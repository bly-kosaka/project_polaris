import type { ViewTruncation } from '../truncation/types.js';

export interface KeepAllResult<T> {
  kept: T[];
  truncation: ViewTruncation;
}

/**
 * Status/Method/Time views are naturally low-cardinality, so they're kept
 * in full rather than axis-selected — only compressed if they exceed their
 * own total limit, by request count (08 §18.3 / 28 §12-13, §15.1).
 */
export function keepAllUpToLimit<T>(
  items: T[],
  requestCountOf: (item: T) => number,
  keyOf: (item: T) => string,
  limit: number,
): KeepAllResult<T> {
  if (items.length <= limit) {
    return { kept: items, truncation: { totalGroups: items.length, selectedGroups: items.length, omittedGroups: 0 } };
  }
  const sorted = [...items].sort(
    (a, b) => requestCountOf(b) - requestCountOf(a) || (keyOf(a) < keyOf(b) ? -1 : 1),
  );
  const kept = sorted.slice(0, limit);
  return {
    kept,
    truncation: { totalGroups: items.length, selectedGroups: kept.length, omittedGroups: items.length - kept.length },
  };
}
