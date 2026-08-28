import type { AggregationSet } from '../aggregation/types.js';
import { RedactionSafetyError } from '../errors.js';
import type { ExclusionSummary } from '../exclusion/types.js';
import { redactQuery, redactReferrer, RedactionSummaryBuilder } from '../redaction/index.js';
import type { RedactionConfig } from '../redaction/types.js';
import { resolveReferences } from '../references/resolve-references.js';
import {
  selectPathGroups,
  selectSourceIpGroups,
  selectSourceIpPathGroups,
  selectUserAgentGroups,
  selectStatusGroups,
  selectMethodGroups,
  selectOneMinuteBuckets,
  selectFiveMinuteBuckets,
  computeKnownInformationOmissions,
} from '../selection/index.js';
import type { CandidateSelectionConfig } from '../selection/types.js';
import { buildTruncationSummary } from '../truncation/build-truncation-summary.js';
import type { ParseSummary } from '../types/parse-summary.js';
import { buildOverview } from './build-overview.js';
import {
  buildMethodGroupId,
  buildPathGroupId,
  buildSourceIpGroupId,
  buildSourceIpPathGroupId,
  buildStatusGroupId,
  buildTimeBucketGroupId,
  buildUserAgentGroupId,
} from './group-id.js';
import { SCHEMA_VERSION } from './types.js';
import type { ObservationSet } from './types.js';

export interface BuildObservationSetParams {
  /** Must already be annotated with Known Information (annotateAggregationSet output). */
  aggregationSet: AggregationSet;
  parseSummary: ParseSummary;
  exclusion: ExclusionSummary;
  selectionConfig: CandidateSelectionConfig;
  redactionConfig: RedactionConfig;
  knownInformationDatasetVersion: string;
}

/**
 * Verifies every parameter name that was supposedly redacted now has the
 * literal value "[REDACTED]" in the output. Checking by re-running
 * redaction on the output would always "match" again — the parameter
 * NAME is deliberately preserved, only the value changes — so this checks
 * the actual value instead. This is the one place RedactionSafetyError
 * actually fires.
 */
function assertQueryFullyRedacted(value: string, redactedParameterNames: string[]): void {
  if (redactedParameterNames.length === 0) return;
  const redactedSet = new Set(redactedParameterNames);
  for (const [key, paramValue] of new URLSearchParams(value).entries()) {
    if (redactedSet.has(key.toLowerCase()) && paramValue !== '[REDACTED]') {
      throw new RedactionSafetyError('Sensitive query parameter survived redaction');
    }
  }
}

function assertReferrerFullyRedacted(value: string, redactedParameterNames: string[]): void {
  if (redactedParameterNames.length === 0) return;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RedactionSafetyError('Redacted referrer is not a valid URL');
  }
  assertQueryFullyRedacted(url.search.startsWith('?') ? url.search.slice(1) : url.search, redactedParameterNames);
}

function redactSampleQueries(
  samples: string[],
  config: RedactionConfig,
  builder: RedactionSummaryBuilder,
): string[] {
  const result: string[] = [];
  for (const sample of samples) {
    const redacted = redactQuery(sample, config.sensitiveParameterNames);
    if (redacted.kind === 'dropped') {
      builder.recordQueryDropped();
      continue;
    }
    assertQueryFullyRedacted(redacted.value, redacted.redactedParameterNames);
    builder.recordQuery(redacted.redactedParameterNames);
    result.push(redacted.value);
  }
  return result;
}

function redactSampleReferrers(
  samples: string[],
  config: RedactionConfig,
  builder: RedactionSummaryBuilder,
): string[] {
  const result: string[] = [];
  for (const sample of samples) {
    const redacted = redactReferrer(sample, config.sensitiveParameterNames);
    if (redacted.kind === 'dropped') {
      builder.recordReferrerDropped();
      continue;
    }
    assertReferrerFullyRedacted(redacted.value, redacted.redactedParameterNames);
    builder.recordReferrer(redacted.redactedParameterNames);
    result.push(redacted.value);
  }
  return result;
}

function chronological(a: { value: { bucketStart: string } }, b: { value: { bucketStart: string } }): number {
  return a.value.bucketStart < b.value.bucketStart ? -1 : a.value.bucketStart > b.value.bucketStart ? 1 : 0;
}

export function buildObservationSet(params: BuildObservationSetParams): ObservationSet {
  const { aggregationSet, parseSummary, exclusion, selectionConfig, redactionConfig, knownInformationDatasetVersion } =
    params;

  const pathSelection = selectPathGroups(aggregationSet.paths, selectionConfig);
  const sourceIpSelection = selectSourceIpGroups(aggregationSet.sourceIps, selectionConfig);
  const sourceIpPathSelection = selectSourceIpPathGroups(aggregationSet.sourceIpPaths, selectionConfig);
  const userAgentSelection = selectUserAgentGroups(aggregationSet.userAgents, selectionConfig);
  const statusSelection = selectStatusGroups(aggregationSet.statuses, selectionConfig);
  const methodSelection = selectMethodGroups(aggregationSet.methods, selectionConfig);
  const oneMinuteSelection = selectOneMinuteBuckets(aggregationSet.timeBuckets.oneMinute, selectionConfig);
  const fiveMinuteSelection = selectFiveMinuteBuckets(aggregationSet.timeBuckets.fiveMinute, selectionConfig);

  // Group IDs assigned only now — after selection is final (08 §24.7).
  const pathGroups = pathSelection.selected.map((g) => ({
    groupId: buildPathGroupId(g.value.path),
    value: g.value,
    selectionReasons: g.selectionReasons,
  }));
  const sourceIpGroups = sourceIpSelection.selected.map((g) => ({
    groupId: buildSourceIpGroupId(g.value.sourceIp),
    value: g.value,
    selectionReasons: g.selectionReasons,
  }));
  const userAgentGroups = userAgentSelection.selected.map((g) => ({
    groupId: buildUserAgentGroupId(g.value.userAgent),
    value: g.value,
    selectionReasons: g.selectionReasons,
  }));
  const statusGroups = statusSelection.kept.map((value) => ({ groupId: buildStatusGroupId(value.status), value }));
  const methodGroups = methodSelection.kept.map((value) => ({ groupId: buildMethodGroupId(value.method), value }));
  const oneMinuteGroups = oneMinuteSelection.kept
    .map((value) => ({ groupId: buildTimeBucketGroupId('1m', value.bucketStart), value }))
    .sort(chronological);
  const fiveMinuteGroups = fiveMinuteSelection.kept
    .map((value) => ({ groupId: buildTimeBucketGroupId('5m', value.bucketStart), value }))
    .sort(chronological);

  const pathGroupIdByPath = new Map(pathGroups.map((g) => [g.value.path, g.groupId]));
  const sourceIpGroupIdBySourceIp = new Map(sourceIpGroups.map((g) => [g.value.sourceIp, g.groupId]));

  const { resolved: referencedSourceIpPaths, summary: referenceSummary } = resolveReferences(
    sourceIpPathSelection.selected,
    pathGroupIdByPath,
    sourceIpGroupIdBySourceIp,
  );
  const sourceIpPathGroups = referencedSourceIpPaths.map((g) => ({
    groupId: buildSourceIpPathGroupId(g.value.sourceIp, g.value.path),
    value: g.value,
    selectionReasons: g.selectionReasons,
  }));

  const redactionSummaryBuilder = new RedactionSummaryBuilder();
  const redactedPathGroups = pathGroups.map((g) => ({
    ...g,
    value: {
      ...g.value,
      sampleQueries: redactSampleQueries(g.value.sampleQueries, redactionConfig, redactionSummaryBuilder),
      sampleReferrers: redactSampleReferrers(g.value.sampleReferrers, redactionConfig, redactionSummaryBuilder),
    },
  }));

  const knownInformationOmissions = computeKnownInformationOmissions(aggregationSet.paths, pathSelection.selected);
  const truncation = buildTruncationSummary(
    {
      paths: pathSelection.truncation,
      sourceIps: sourceIpSelection.truncation,
      sourceIpPaths: sourceIpPathSelection.truncation,
      statuses: statusSelection.truncation,
      methods: methodSelection.truncation,
      userAgents: userAgentSelection.truncation,
      time1m: oneMinuteSelection.truncation,
      time5m: fiveMinuteSelection.truncation,
    },
    knownInformationOmissions,
  );

  const matchedEntryIds = new Set<string>();
  let matchedPathCount = 0;
  for (const path of aggregationSet.paths) {
    if (path.knownInformation.length === 0) continue;
    matchedPathCount += 1;
    for (const match of path.knownInformation) matchedEntryIds.add(match.id);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    overview: buildOverview(aggregationSet, parseSummary),
    parseSummary,
    aggregations: {
      paths: redactedPathGroups,
      sourceIps: sourceIpGroups,
      sourceIpPaths: sourceIpPathGroups,
      statuses: statusGroups,
      methods: methodGroups,
      userAgents: userAgentGroups,
      time: { oneMinute: oneMinuteGroups, fiveMinute: fiveMinuteGroups },
    },
    truncation,
    redaction: redactionSummaryBuilder.build(),
    knownInformation: {
      builtInDatasetVersion: knownInformationDatasetVersion,
      matchedPathCount,
      matchedEntryIds: Array.from(matchedEntryIds).sort(),
      omittedMatchedGroupCount: knownInformationOmissions.reduce((sum, o) => sum + o.omittedGroupCount, 0),
    },
    references: referenceSummary,
    exclusion,
  };
}
