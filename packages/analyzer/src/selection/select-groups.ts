import type { ViewTruncation } from '../truncation/types.js';
import type { SelectedGroup, SelectionReason } from './types.js';

export interface AxisDefinition<T> {
  reason: SelectionReason;
  limit: number;
  /** Returns undefined when the axis doesn't apply to this item (excluded from ranking). */
  score: (item: T) => number | undefined;
}

export interface SelectGroupsResult<T> {
  selected: SelectedGroup<T>[];
  truncation: ViewTruncation;
}

const REASON_ORDER: SelectionReason[] = [
  'known_information',
  'request_count',
  'distinct_source_ip',
  'distinct_path',
  'status_4xx',
  'status_5xx',
  'method_post',
  'response_size',
  'representative',
];

function sortReasons(reasons: Set<SelectionReason>): SelectionReason[] {
  return REASON_ORDER.filter((reason) => reasons.has(reason));
}

/**
 * Multi-axis candidate selection — this is Input Size Control, never a
 * reweighted importance score (28_Development_Setup_and_Second_Sprint.md §22-25).
 * A group hit by multiple axes is deduplicated into one SelectedGroup with
 * every reason recorded (never a summed score).
 */
export function selectGroups<T>(
  items: T[],
  keyOf: (item: T) => string,
  requestCountOf: (item: T) => number,
  axes: AxisDefinition<T>[],
  representativeLimit: number,
  totalLimit: number,
): SelectGroupsResult<T> {
  const itemByKey = new Map<string, T>();
  const reasonsByKey = new Map<string, Set<SelectionReason>>();
  for (const item of items) itemByKey.set(keyOf(item), item);

  const markSelected = (item: T, reason: SelectionReason): void => {
    const key = keyOf(item);
    let reasons = reasonsByKey.get(key);
    if (!reasons) {
      reasons = new Set();
      reasonsByKey.set(key, reasons);
    }
    reasons.add(reason);
  };

  for (const axis of axes) {
    const ranked = items
      .map((item) => ({ item, value: axis.score(item) }))
      .filter((entry): entry is { item: T; value: number } => entry.value !== undefined)
      .sort((a, b) => b.value - a.value || (keyOf(a.item) < keyOf(b.item) ? -1 : 1))
      .slice(0, axis.limit);
    for (const { item } of ranked) markSelected(item, axis.reason);
  }

  const selectedSoFar = new Set(reasonsByKey.keys());
  const representatives = items
    .filter((item) => !selectedSoFar.has(keyOf(item)))
    .sort((a, b) => (keyOf(a) < keyOf(b) ? -1 : 1))
    .slice(0, representativeLimit);
  for (const item of representatives) markSelected(item, 'representative');

  const deduped: SelectedGroup<T>[] = Array.from(reasonsByKey.entries()).map(([key, reasons]) => {
    const value = itemByKey.get(key);
    if (value === undefined) throw new Error(`selection key vanished: ${key}`);
    return { value, selectionReasons: sortReasons(reasons) };
  });

  // omittedGroups is always totalGroups - selectedGroups — including groups
  // that never hit any axis or the representative fill and so never entered
  // `deduped` at all. Counting only deduped.length - kept.length undercounts
  // exactly those never-candidate groups, which breaks the
  // selectedGroups + omittedGroups === totalGroups invariant on any
  // high-cardinality input (30_Sprint_2_Review.md C-01).
  const totalGroups = items.length;
  if (deduped.length <= totalLimit) {
    return {
      selected: deduped,
      truncation: { totalGroups, selectedGroups: deduped.length, omittedGroups: totalGroups - deduped.length },
    };
  }

  // Over the total limit: Known Information matches are kept first, then by
  // request count — never a weighted score, just a deterministic priority
  // order for size control (08 §18.8).
  const prioritized = [...deduped].sort((a, b) => {
    const aKnown = a.selectionReasons.includes('known_information');
    const bKnown = b.selectionReasons.includes('known_information');
    if (aKnown !== bKnown) return aKnown ? -1 : 1;
    const countDiff = requestCountOf(b.value) - requestCountOf(a.value);
    if (countDiff !== 0) return countDiff;
    return keyOf(a.value) < keyOf(b.value) ? -1 : 1;
  });
  const kept = prioritized.slice(0, totalLimit);
  return {
    selected: kept,
    truncation: { totalGroups, selectedGroups: kept.length, omittedGroups: totalGroups - kept.length },
  };
}
