import { KNOWN_INFORMATION_SOURCE_PRIORITY } from './types.js';
import type { KnownInformationEntry, KnownInformationMatch } from './types.js';

/**
 * user > project > built_in; within a source, exact beats prefix; among
 * prefixes, the longer/more specific pattern wins
 * (28_Development_Setup_and_Second_Sprint.md §21). All matches are kept
 * (never dropped), only the winner is flagged `isPrimary`
 * (08_Detection_Rules.md §16.6).
 */
function compareEntries(a: KnownInformationEntry, b: KnownInformationEntry): number {
  const priorityDiff =
    KNOWN_INFORMATION_SOURCE_PRIORITY[a.source] - KNOWN_INFORMATION_SOURCE_PRIORITY[b.source];
  if (priorityDiff !== 0) return priorityDiff;
  if (a.matchType !== b.matchType) return a.matchType === 'exact' ? -1 : 1;
  if (a.matchType === 'prefix') return b.pattern.length - a.pattern.length;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function resolveMatches(candidates: KnownInformationEntry[]): KnownInformationMatch[] {
  return [...candidates].sort(compareEntries).map((entry, index) => ({
    id: entry.id,
    title: entry.title,
    ...(entry.description !== undefined ? { description: entry.description } : {}),
    source: entry.source,
    isPrimary: index === 0,
  }));
}
