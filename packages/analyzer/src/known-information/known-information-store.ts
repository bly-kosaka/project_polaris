import { findMatchingEntries } from './matcher.js';
import { resolveMatches } from './priority-resolution.js';
import type { KnownInformationEntry, KnownInformationMatch } from './types.js';

export class KnownInformationStore {
  constructor(private readonly entries: KnownInformationEntry[]) {}

  matchPath(path: string): KnownInformationMatch[] {
    const candidates = findMatchingEntries(path, this.entries);
    if (candidates.length === 0) return [];
    return resolveMatches(candidates);
  }
}
