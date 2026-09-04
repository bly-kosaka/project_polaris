import { describe, expect, it } from 'vitest';
import { observationSetSchema } from '../../api/schemas';

function minimalObservationSet() {
  const emptyView = { totalGroups: 0, selectedGroups: 0, omittedGroups: 0 };
  return {
    schemaVersion: '1.0.0',
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
    references: {
      resolvedPathRefs: 0,
      resolvedSourceIpRefs: 0,
      unresolvedPathRefs: 0,
      unresolvedSourceIpRefs: 0,
    },
    exclusion: { excludedEntryCount: 0 },
  };
}

describe('observationSetSchema', () => {
  it('accepts a minimal, structurally valid ObservationSet', () => {
    const result = observationSetSchema.safeParse(minimalObservationSet());
    expect(result.success).toBe(true);
  });

  it('rejects a payload missing a required field', () => {
    const payload = minimalObservationSet() as Record<string, unknown>;
    delete payload.overview;
    const result = observationSetSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects a payload with the wrong type for a known field', () => {
    const payload = minimalObservationSet();
    // @ts-expect-error deliberately wrong type for this test
    payload.overview.totalRequests = 'not a number';
    const result = observationSetSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
