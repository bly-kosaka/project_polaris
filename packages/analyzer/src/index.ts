export type {
  NormalizedAccessLogEntry,
  ParseWarning,
  ParseResult,
  ParseSummary,
  ParseWarningSummary,
} from './types/index.js';

export { readLines } from './streaming/read-lines.js';

export type { AccessLogParser, RawAccessLogFields } from './parser/index.js';
export {
  COMBINED_LOG_PATTERN,
  COMMON_LOG_PATTERN,
  createRegexParser,
  createDefaultParserChain,
  parseLine,
} from './parser/index.js';

export { normalizeFields } from './normalizer/index.js';
export type { NormalizeOutcome } from './normalizer/index.js';

export { ParseSummaryBuilder, deriveAnalyzerStatus } from './summary/index.js';

export { parseAccessLogStream, collectParsedEntries } from './parse-access-log.js';
export type { ParseAccessLogStreamOptions, CollectedParseResult } from './parse-access-log.js';

// Sprint 2 — Aggregation → ObservationSet

export { analyzeAccessLog } from './analyze.js';
export type { AnalyzeAccessLogConfig, AnalyzeAccessLogResult } from './analyze.js';

export {
  AggregationError,
  RedactionSafetyError,
  ObservationSetValidationError,
  mapAnalyzerFailure,
} from './errors.js';
export type { AnalyzerErrorCode, AnalyzerFailureResult } from './errors.js';

export { checkExclusion, ExclusionSummaryBuilder } from './exclusion/index.js';
export type { ExclusionRule, ExclusionConfig, ExclusionSummary, ExclusionCheckResult } from './exclusion/index.js';

export { AggregationEngine, DEFAULT_AGGREGATION_CONFIG, FirstNSample } from './aggregation/index.js';
export type {
  CountEntry,
  CountMap,
  RankedCount,
  ResponseSizeSummary,
  TimeBucketCount,
  AggregationConfig,
  PathAggregation,
  SourceIpAggregation,
  SourceIpPathAggregation,
  StatusAggregation,
  MethodAggregation,
  UserAgentAggregation,
  TimeBucketAggregation,
  AggregationSet,
} from './aggregation/index.js';

export {
  BUILT_IN_KNOWN_INFORMATION_DATASET,
  BUILT_IN_KNOWN_INFORMATION_DATASET_VERSION,
  KnownInformationStore,
  annotateAggregationSet,
} from './known-information/index.js';
export type {
  KnownInformationSource,
  KnownInformationMatchType,
  KnownInformationEntry,
  KnownInformationMatch,
} from './known-information/index.js';

export { DEFAULT_CANDIDATE_SELECTION_CONFIG } from './selection/index.js';
export type { SelectionReason, SelectedGroup, CandidateSelectionConfig } from './selection/index.js';

export { DEFAULT_SENSITIVE_PARAMETER_NAMES, DEFAULT_REDACTION_CONFIG } from './redaction/index.js';
export type { RedactionConfig, RedactionSummary } from './redaction/index.js';

export type { TruncationSummary, ViewTruncation, KnownInformationOmission } from './truncation/index.js';

export type { ObservationReference, ObservationReferenceSummary } from './references/index.js';

export { validateObservationSet, SCHEMA_VERSION as OBSERVATION_SET_SCHEMA_VERSION } from './observation-set/index.js';
export type { ObservationSet, ObservationOverview, KnownInformationSummary } from './observation-set/index.js';
