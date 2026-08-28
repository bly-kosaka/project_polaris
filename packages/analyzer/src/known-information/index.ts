export type {
  KnownInformationSource,
  KnownInformationMatchType,
  KnownInformationEntry,
  KnownInformationMatch,
} from './types.js';
export { KNOWN_INFORMATION_SOURCE_PRIORITY } from './types.js';
export {
  BUILT_IN_KNOWN_INFORMATION_DATASET,
  BUILT_IN_KNOWN_INFORMATION_DATASET_VERSION,
} from './built-in-dataset.js';
export { findMatchingEntries } from './matcher.js';
export { resolveMatches } from './priority-resolution.js';
export { KnownInformationStore } from './known-information-store.js';
export { annotateAggregationSet } from './annotate-aggregation.js';
