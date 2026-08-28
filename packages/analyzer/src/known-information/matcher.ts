import { matchesExact, matchesPrefix } from '../shared/path-match.js';
import type { KnownInformationEntry } from './types.js';

/** Exact and prefix only — no regex, no contains (28_Development_Setup_and_Second_Sprint.md §19). */
export function findMatchingEntries(path: string, entries: KnownInformationEntry[]): KnownInformationEntry[] {
  return entries.filter((entry) =>
    entry.matchType === 'exact' ? matchesExact(path, entry.pattern) : matchesPrefix(path, entry.pattern),
  );
}
