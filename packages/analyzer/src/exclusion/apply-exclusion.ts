import type { NormalizedAccessLogEntry } from '../types/normalized-entry.js';
import { matchesExact, matchesPrefix } from '../shared/path-match.js';
import type { ExclusionConfig, ExclusionRule } from './types.js';

export type ExclusionCheckResult = { excluded: false } | { excluded: true; ruleId: string };

function ruleMatches(entry: NormalizedAccessLogEntry, rule: ExclusionRule): boolean {
  if (rule.target === 'path') {
    if (entry.path === undefined) return false;
    return rule.matchType === 'exact'
      ? matchesExact(entry.path, rule.value)
      : matchesPrefix(entry.path, rule.value);
  }
  return entry.sourceIp !== undefined && entry.sourceIp === rule.value;
}

/**
 * Exclusion is not a safety judgment — it's an analysis-scope setting
 * (26_Development_Setup_and_First_Sprint.md §16 / 28 §6.1). An entry
 * matching any configured rule is dropped before it ever reaches Aggregation.
 */
export function checkExclusion(
  entry: NormalizedAccessLogEntry,
  config: ExclusionConfig,
): ExclusionCheckResult {
  for (const rule of config.rules) {
    if (ruleMatches(entry, rule)) {
      return { excluded: true, ruleId: rule.id };
    }
  }
  return { excluded: false };
}
