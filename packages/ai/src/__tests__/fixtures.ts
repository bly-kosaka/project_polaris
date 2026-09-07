import type { ObservationSet } from '@polaris/analyzer';

const emptyView = { totalGroups: 0, selectedGroups: 0, omittedGroups: 0 };

/**
 * A minimal, structurally valid ObservationSet with no groups at all —
 * enough for PromptBuilder tests and as a base for Grounding tests that add
 * their own groups on top.
 */
export function emptyObservationSet(): ObservationSet {
  return {
    schemaVersion: '2.0.0',
    overview: {
      totalRequests: 0,
      parsedRequests: 0,
      partialRequests: 0,
      failedRequests: 0,
      distinctSourceIps: 0,
      distinctPaths: 0,
      distinctUserAgents: 0,
      firstSeen: null,
      lastSeen: null,
      totalResponseBytes: null,
      statusDistribution: [],
      methodDistribution: [],
    },
    parseSummary: { totalLines: 0, parsedLines: 0, partialLines: 0, failedLines: 0, warnings: [] },
    aggregations: {
      paths: [],
      sourceIps: [],
      sourceIpPaths: [],
      statuses: [],
      methods: [],
      userAgents: [],
      time: { oneMinute: [], fiveMinute: [] },
    },
    truncation: {
      truncated: false,
      views: {
        paths: emptyView,
        sourceIps: emptyView,
        sourceIpPaths: emptyView,
        statuses: emptyView,
        methods: emptyView,
        userAgents: emptyView,
        time1m: emptyView,
        time5m: emptyView,
      },
      knownInformationOmissions: [],
    },
    redaction: {
      appliedParameterNames: [],
      redactedQuerySampleCount: 0,
      redactedReferrerSampleCount: 0,
      droppedQuerySampleCount: 0,
      droppedReferrerSampleCount: 0,
    },
    knownInformation: {
      builtInDatasetVersion: '1',
      matchedPathCount: 0,
      matchedEntryIds: [],
      omittedMatchedGroupCount: 0,
    },
    references: { resolvedPathRefs: 0, resolvedSourceIpRefs: 0, unresolvedPathRefs: 0, unresolvedSourceIpRefs: 0 },
    exclusion: { excludedEntryCount: 0 },
  };
}

/**
 * Adds one real Path group (with a real, stable groupId) on top of
 * `emptyObservationSet()` — used by Grounding tests that need a groupId
 * that genuinely resolves.
 */
export function observationSetWithOnePathGroup(groupId: string): ObservationSet {
  const base = emptyObservationSet();
  return {
    ...base,
    aggregations: {
      ...base.aggregations,
      paths: [
        {
          groupId,
          selectionReasons: ['request_count'],
          value: {
            path: '/example',
            requestCount: 1,
            distinctSourceIpCount: 1,
            distinctUserAgentCount: 1,
            queryVariantCount: 0,
            methodDistribution: [{ key: 'GET', count: 1 }],
            statusDistribution: [{ key: 200, count: 1 }],
            referrerHostDistribution: [],
            responseSize: { count: 1, total: 100, min: 100, max: 100, average: 100 },
            firstSeen: '2026-01-01T00:00:00.000Z',
            lastSeen: '2026-01-01T00:00:00.000Z',
            timeDistribution: [],
            sampleSourceIps: ['203.0.113.1'],
            sampleQueries: [],
            sampleReferrers: [],
            knownInformation: [],
          },
        },
      ],
    },
  };
}
