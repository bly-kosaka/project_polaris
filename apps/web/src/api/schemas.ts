import { z } from 'zod';

/**
 * The frontend's own Zod schema for the ObservationSet wire response — the
 * sole source of these types on the frontend (`z.infer`), deliberately not
 * a `type`-only import of `@polaris/analyzer`'s internal types
 * (40_Sprint_5_Plan_Review.md F-02: that package's `types` field resolves
 * to a `dist/*.d.ts` that doesn't exist until the backend build graph has
 * run once, which would make apps/web's typecheck secretly depend on
 * backend build order despite being an independent toolchain). Covers
 * exactly the fields the UI renders — not a full duplicate of every
 * internal Analyzer field.
 */

const countMapSchema = z.array(z.object({ key: z.union([z.string(), z.number()]), count: z.number() }));
const rankedCountSchema = z.array(z.object({ value: z.string(), count: z.number() }));

const responseSizeSummarySchema = z.object({
  count: z.number(),
  total: z.number(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  average: z.number().nullable(),
});

const timeBucketCountSchema = z.object({ bucketStart: z.string(), count: z.number() });

const knownInformationMatchSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  source: z.enum(['built_in', 'project', 'user']),
  isPrimary: z.boolean(),
});

const observationReferenceSchema = z.object({
  groupId: z.string(),
  groupType: z.enum(['path', 'source_ip']),
});

const selectionReasonSchema = z.enum([
  'known_information',
  'request_count',
  'distinct_source_ip',
  'distinct_path',
  'status_4xx',
  'status_5xx',
  'method_post',
  'response_size',
  'representative',
]);

const pathAggregationSchema = z.object({
  path: z.string(),
  requestCount: z.number(),
  distinctSourceIpCount: z.number(),
  distinctUserAgentCount: z.number(),
  queryVariantCount: z.number(),
  methodDistribution: countMapSchema,
  statusDistribution: countMapSchema,
  referrerHostDistribution: countMapSchema,
  responseSize: responseSizeSummarySchema,
  firstSeen: z.string().nullable(),
  lastSeen: z.string().nullable(),
  timeDistribution: z.array(timeBucketCountSchema),
  sampleSourceIps: z.array(z.string()),
  sampleQueries: z.array(z.string()),
  sampleReferrers: z.array(z.string()),
  knownInformation: z.array(knownInformationMatchSchema),
});

const sourceIpAggregationSchema = z.object({
  sourceIp: z.string(),
  requestCount: z.number(),
  distinctPathCount: z.number(),
  distinctUserAgentCount: z.number(),
  methodDistribution: countMapSchema,
  statusDistribution: countMapSchema,
  responseSize: responseSizeSummarySchema,
  firstSeen: z.string().nullable(),
  lastSeen: z.string().nullable(),
  timeDistribution: z.array(timeBucketCountSchema),
  topPaths: rankedCountSchema,
});

const sourceIpPathAggregationSchema = z.object({
  sourceIp: z.string(),
  path: z.string(),
  requestCount: z.number(),
  queryVariantCount: z.number(),
  methodDistribution: countMapSchema,
  statusDistribution: countMapSchema,
  distinctUserAgentCount: z.number(),
  firstSeen: z.string().nullable(),
  lastSeen: z.string().nullable(),
  timeDistribution: z.array(timeBucketCountSchema),
  knownInformation: z.array(knownInformationMatchSchema),
  pathGroupRef: observationReferenceSchema.optional(),
  sourceIpGroupRef: observationReferenceSchema.optional(),
});

const statusAggregationSchema = z.object({
  status: z.number(),
  requestCount: z.number(),
  distinctPathCount: z.number(),
  distinctSourceIpCount: z.number(),
  topPaths: rankedCountSchema,
  topSourceIps: rankedCountSchema,
  firstSeen: z.string().nullable(),
  lastSeen: z.string().nullable(),
});

const methodAggregationSchema = z.object({
  method: z.string(),
  requestCount: z.number(),
  distinctPathCount: z.number(),
  distinctSourceIpCount: z.number(),
  topPaths: rankedCountSchema,
  topSourceIps: rankedCountSchema,
  firstSeen: z.string().nullable(),
  lastSeen: z.string().nullable(),
});

const userAgentAggregationSchema = z.object({
  userAgent: z.string(),
  requestCount: z.number(),
  distinctPathCount: z.number(),
  distinctSourceIpCount: z.number(),
  methodDistribution: countMapSchema,
  statusDistribution: countMapSchema,
  topPaths: rankedCountSchema,
  firstSeen: z.string().nullable(),
  lastSeen: z.string().nullable(),
});

const timeBucketAggregationSchema = z.object({
  bucketStart: z.string(),
  requestCount: z.number(),
  distinctSourceIpCount: z.number(),
  distinctPathCount: z.number(),
  methodDistribution: countMapSchema,
  statusDistribution: countMapSchema,
  topPaths: rankedCountSchema,
  topSourceIps: rankedCountSchema,
});

function selectedGroupSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({ groupId: z.string(), value: valueSchema, selectionReasons: z.array(selectionReasonSchema) });
}
function groupSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({ groupId: z.string(), value: valueSchema });
}

const parseWarningSummarySchema = z.object({ code: z.string(), count: z.number(), sample: z.string().optional() });

const parseSummarySchema = z.object({
  totalLines: z.number(),
  parsedLines: z.number(),
  partialLines: z.number(),
  failedLines: z.number(),
  warnings: z.array(parseWarningSummarySchema),
});

const viewTruncationSchema = z.object({ totalGroups: z.number(), selectedGroups: z.number(), omittedGroups: z.number() });

const truncationSummarySchema = z.object({
  truncated: z.boolean(),
  views: z.object({
    paths: viewTruncationSchema,
    sourceIps: viewTruncationSchema,
    sourceIpPaths: viewTruncationSchema,
    statuses: viewTruncationSchema,
    methods: viewTruncationSchema,
    userAgents: viewTruncationSchema,
    time1m: viewTruncationSchema,
    time5m: viewTruncationSchema,
  }),
  knownInformationOmissions: z.array(z.object({ knownInformationId: z.string(), omittedGroupCount: z.number() })),
});

const redactionSummarySchema = z.object({
  appliedParameterNames: z.array(z.string()),
  redactedQuerySampleCount: z.number(),
  redactedReferrerSampleCount: z.number(),
  droppedQuerySampleCount: z.number(),
  droppedReferrerSampleCount: z.number(),
});

const exclusionSummarySchema = z.object({
  excludedEntryCount: z.number(),
  byReason: z.array(z.object({ ruleId: z.string(), count: z.number() })).optional(),
});

const knownInformationSummarySchema = z.object({
  builtInDatasetVersion: z.string(),
  matchedPathCount: z.number(),
  matchedEntryIds: z.array(z.string()),
  omittedMatchedGroupCount: z.number(),
});

const observationReferenceSummarySchema = z.object({
  resolvedPathRefs: z.number(),
  resolvedSourceIpRefs: z.number(),
  unresolvedPathRefs: z.number(),
  unresolvedSourceIpRefs: z.number(),
});

export const observationSetSchema = z.object({
  schemaVersion: z.string(),
  overview: z.object({
    totalRequests: z.number(),
    parsedRequests: z.number(),
    partialRequests: z.number(),
    failedRequests: z.number(),
    distinctSourceIps: z.number(),
    distinctPaths: z.number(),
    distinctUserAgents: z.number(),
    firstSeen: z.string().nullable(),
    lastSeen: z.string().nullable(),
    totalResponseBytes: z.number().nullable(),
    statusDistribution: countMapSchema,
    methodDistribution: countMapSchema,
  }),
  parseSummary: parseSummarySchema,
  aggregations: z.object({
    paths: z.array(selectedGroupSchema(pathAggregationSchema)),
    sourceIps: z.array(selectedGroupSchema(sourceIpAggregationSchema)),
    sourceIpPaths: z.array(selectedGroupSchema(sourceIpPathAggregationSchema)),
    statuses: z.array(groupSchema(statusAggregationSchema)),
    methods: z.array(groupSchema(methodAggregationSchema)),
    userAgents: z.array(selectedGroupSchema(userAgentAggregationSchema)),
    time: z.object({
      oneMinute: z.array(groupSchema(timeBucketAggregationSchema)),
      fiveMinute: z.array(groupSchema(timeBucketAggregationSchema)),
    }),
  }),
  truncation: truncationSummarySchema,
  redaction: redactionSummarySchema,
  knownInformation: knownInformationSummarySchema,
  references: observationReferenceSummarySchema,
  exclusion: exclusionSummarySchema,
});

export type ObservationSetDto = z.infer<typeof observationSetSchema>;
export type PathAggregationDto = z.infer<typeof pathAggregationSchema>;
export type SourceIpAggregationDto = z.infer<typeof sourceIpAggregationSchema>;
export type SourceIpPathAggregationDto = z.infer<typeof sourceIpPathAggregationSchema>;
export type StatusAggregationDto = z.infer<typeof statusAggregationSchema>;
export type MethodAggregationDto = z.infer<typeof methodAggregationSchema>;
export type UserAgentAggregationDto = z.infer<typeof userAgentAggregationSchema>;
export type TimeBucketAggregationDto = z.infer<typeof timeBucketAggregationSchema>;
export type KnownInformationMatchDto = z.infer<typeof knownInformationMatchSchema>;
export type CountMapDto = z.infer<typeof countMapSchema>;
export type SelectionReason = z.infer<typeof selectionReasonSchema>;

export interface SelectedGroup<T> {
  groupId: string;
  value: T;
  selectionReasons: SelectionReason[];
}

export interface Group<T> {
  groupId: string;
  value: T;
}
