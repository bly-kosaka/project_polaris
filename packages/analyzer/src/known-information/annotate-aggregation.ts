import type { AggregationSet } from '../aggregation/types.js';
import type { KnownInformationStore } from './known-information-store.js';
import type { KnownInformationMatch } from './types.js';

/**
 * Matches against unique aggregated paths only — never per raw line
 * (28_Development_Setup_and_Second_Sprint.md §21). Source-IP×Path rows
 * reuse their path's already-computed match instead of matching again.
 */
export function annotateAggregationSet(set: AggregationSet, store: KnownInformationStore): AggregationSet {
  const matchesByPath = new Map<string, KnownInformationMatch[]>();

  const paths = set.paths.map((pathAggregation) => {
    const matches = store.matchPath(pathAggregation.path);
    matchesByPath.set(pathAggregation.path, matches);
    return matches.length === 0 ? pathAggregation : { ...pathAggregation, knownInformation: matches };
  });

  const sourceIpPaths = set.sourceIpPaths.map((entry) => {
    const matches = matchesByPath.get(entry.path) ?? store.matchPath(entry.path);
    return matches.length === 0 ? entry : { ...entry, knownInformation: matches };
  });

  return { ...set, paths, sourceIpPaths };
}
