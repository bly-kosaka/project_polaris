import type { KnownInformationMatch } from '../known-information/types.js';
import type { ObservationReference } from '../references/types.js';

export interface CountEntry<K> {
  key: K;
  count: number;
}
export type CountMap<K> = CountEntry<K>[];

export interface RankedCount<T> {
  value: T;
  count: number;
}

export interface ResponseSizeSummary {
  count: number;
  total: number;
  min: number | null;
  max: number | null;
  average: number | null;
}

export interface TimeBucketCount {
  bucketStart: string;
  count: number;
}

export interface AggregationConfig {
  /** Target size for FirstNSample-backed illustrative samples (sampleQueries/sampleSourceIps/sampleReferrers). */
  sampleLimit: number;
  /** How many entries each group's exact topPaths/topSourceIps ranking keeps. */
  topPathLimit: number;
  topSourceIpLimit: number;
}

export const DEFAULT_AGGREGATION_CONFIG: AggregationConfig = {
  sampleLimit: 5,
  topPathLimit: 10,
  topSourceIpLimit: 10,
};

export interface PathAggregation {
  path: string;
  requestCount: number;
  distinctSourceIpCount: number;
  distinctUserAgentCount: number;
  queryVariantCount: number;
  methodDistribution: CountMap<string>;
  statusDistribution: CountMap<number>;
  referrerHostDistribution: CountMap<string>;
  responseSize: ResponseSizeSummary;
  firstSeen: string | null;
  lastSeen: string | null;
  timeDistribution: TimeBucketCount[];
  sampleSourceIps: string[];
  sampleQueries: string[];
  sampleReferrers: string[];
  knownInformation: KnownInformationMatch[];
}

export interface SourceIpAggregation {
  sourceIp: string;
  requestCount: number;
  distinctPathCount: number;
  distinctUserAgentCount: number;
  methodDistribution: CountMap<string>;
  statusDistribution: CountMap<number>;
  responseSize: ResponseSizeSummary;
  firstSeen: string | null;
  lastSeen: string | null;
  timeDistribution: TimeBucketCount[];
  topPaths: RankedCount<string>[];
}

export interface SourceIpPathAggregation {
  sourceIp: string;
  path: string;
  requestCount: number;
  queryVariantCount: number;
  methodDistribution: CountMap<string>;
  statusDistribution: CountMap<number>;
  distinctUserAgentCount: number;
  firstSeen: string | null;
  lastSeen: string | null;
  timeDistribution: TimeBucketCount[];
  knownInformation: KnownInformationMatch[];
  /** Populated only after Reference Resolution on the selected copy — always undefined in the raw AggregationSet. */
  pathGroupRef?: ObservationReference;
  sourceIpGroupRef?: ObservationReference;
}

export interface StatusAggregation {
  status: number;
  requestCount: number;
  distinctPathCount: number;
  distinctSourceIpCount: number;
  topPaths: RankedCount<string>[];
  topSourceIps: RankedCount<string>[];
  firstSeen: string | null;
  lastSeen: string | null;
}

export interface MethodAggregation {
  method: string;
  requestCount: number;
  distinctPathCount: number;
  distinctSourceIpCount: number;
  topPaths: RankedCount<string>[];
  topSourceIps: RankedCount<string>[];
  firstSeen: string | null;
  lastSeen: string | null;
}

export interface UserAgentAggregation {
  userAgent: string;
  requestCount: number;
  distinctPathCount: number;
  distinctSourceIpCount: number;
  methodDistribution: CountMap<string>;
  statusDistribution: CountMap<number>;
  topPaths: RankedCount<string>[];
  firstSeen: string | null;
  lastSeen: string | null;
}

export interface TimeBucketAggregation {
  bucketStart: string;
  requestCount: number;
  distinctSourceIpCount: number;
  distinctPathCount: number;
  methodDistribution: CountMap<string>;
  statusDistribution: CountMap<number>;
  topPaths: RankedCount<string>[];
  topSourceIps: RankedCount<string>[];
}

export interface AggregationSet {
  paths: PathAggregation[];
  sourceIps: SourceIpAggregation[];
  sourceIpPaths: SourceIpPathAggregation[];
  statuses: StatusAggregation[];
  methods: MethodAggregation[];
  userAgents: UserAgentAggregation[];
  timeBuckets: {
    oneMinute: TimeBucketAggregation[];
    fiveMinute: TimeBucketAggregation[];
  };
  overview: {
    totalRequests: number;
    distinctSourceIps: number;
    distinctPaths: number;
    distinctUserAgents: number;
    firstSeen: string | null;
    lastSeen: string | null;
    totalResponseBytes: number | null;
    statusDistribution: CountMap<number>;
    methodDistribution: CountMap<string>;
  };
}
