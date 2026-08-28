import type {
  CountMap,
  MethodAggregation,
  PathAggregation,
  SourceIpAggregation,
  SourceIpPathAggregation,
  StatusAggregation,
  TimeBucketAggregation,
  UserAgentAggregation,
} from '../aggregation/types.js';
import type { ExclusionSummary } from '../exclusion/types.js';
import type { RedactionSummary } from '../redaction/types.js';
import type { ObservationReferenceSummary } from '../references/types.js';
import type { SelectionReason } from '../selection/types.js';
import type { TruncationSummary } from '../truncation/types.js';
import type { ParseSummary } from '../types/parse-summary.js';

export const SCHEMA_VERSION = '2.0.0';

export interface ObservationOverview {
  totalRequests: number;
  parsedRequests: number;
  partialRequests: number;
  failedRequests: number;
  distinctSourceIps: number;
  distinctPaths: number;
  distinctUserAgents: number;
  firstSeen: string | null;
  lastSeen: string | null;
  totalResponseBytes: number | null;
  statusDistribution: CountMap<number>;
  methodDistribution: CountMap<string>;
}

export interface SelectedPathGroup {
  groupId: string;
  value: PathAggregation;
  selectionReasons: SelectionReason[];
}
export interface SelectedSourceIpGroup {
  groupId: string;
  value: SourceIpAggregation;
  selectionReasons: SelectionReason[];
}
export interface SelectedSourceIpPathGroup {
  groupId: string;
  value: SourceIpPathAggregation;
  selectionReasons: SelectionReason[];
}
export interface SelectedUserAgentGroup {
  groupId: string;
  value: UserAgentAggregation;
  selectionReasons: SelectionReason[];
}

/** Not wrapped as a SelectedGroup — kept in full up to a limit, never axis-selected (28 §37). */
export interface StatusGroup {
  groupId: string;
  value: StatusAggregation;
}
export interface MethodGroup {
  groupId: string;
  value: MethodAggregation;
}

export interface TimeBucketGroup {
  groupId: string;
  value: TimeBucketAggregation;
}

export interface TimeAggregation {
  oneMinute: TimeBucketGroup[];
  fiveMinute: TimeBucketGroup[];
}

export interface KnownInformationSummary {
  builtInDatasetVersion: string;
  matchedPathCount: number;
  matchedEntryIds: string[];
  omittedMatchedGroupCount: number;
}

export interface ObservationSet {
  schemaVersion: string;
  overview: ObservationOverview;
  parseSummary: ParseSummary;
  aggregations: {
    paths: SelectedPathGroup[];
    sourceIps: SelectedSourceIpGroup[];
    sourceIpPaths: SelectedSourceIpPathGroup[];
    statuses: StatusGroup[];
    methods: MethodGroup[];
    userAgents: SelectedUserAgentGroup[];
    time: TimeAggregation;
  };
  truncation: TruncationSummary;
  redaction: RedactionSummary;
  knownInformation: KnownInformationSummary;
  references: ObservationReferenceSummary;
  exclusion: ExclusionSummary;
}
