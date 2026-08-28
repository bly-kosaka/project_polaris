import { ObservationSetValidationError } from '../errors.js';
import type { SelectionReason } from '../selection/types.js';
import type { ViewTruncation } from '../truncation/types.js';
import type { ObservationSet } from './types.js';

const FORBIDDEN_FIELDS = new Set([
  'severity',
  'priority',
  'riskScore',
  'urgency',
  'intent',
  'attackType',
  'nextAction',
  'conclusion',
]);

const VALID_SELECTION_REASONS = new Set<SelectionReason>([
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

function assertNoForbiddenFields(value: unknown, path: string): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenFields(item, `${path}[${index}]`));
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_FIELDS.has(key)) {
      throw new ObservationSetValidationError(`Forbidden semantic field "${key}" found at ${path}.${key}`);
    }
    assertNoForbiddenFields(nested, `${path}.${key}`);
  }
}

function assertGroupIdsUnique(observationSet: ObservationSet): void {
  const allIds = [
    ...observationSet.aggregations.paths.map((g) => g.groupId),
    ...observationSet.aggregations.sourceIps.map((g) => g.groupId),
    ...observationSet.aggregations.sourceIpPaths.map((g) => g.groupId),
    ...observationSet.aggregations.statuses.map((g) => g.groupId),
    ...observationSet.aggregations.methods.map((g) => g.groupId),
    ...observationSet.aggregations.userAgents.map((g) => g.groupId),
    ...observationSet.aggregations.time.oneMinute.map((g) => g.groupId),
    ...observationSet.aggregations.time.fiveMinute.map((g) => g.groupId),
  ];
  const seen = new Set<string>();
  for (const id of allIds) {
    if (seen.has(id)) throw new ObservationSetValidationError(`Duplicate groupId: ${id}`);
    seen.add(id);
  }
}

function assertReferencesValid(observationSet: ObservationSet): void {
  const pathIds = new Set(observationSet.aggregations.paths.map((g) => g.groupId));
  const sourceIpIds = new Set(observationSet.aggregations.sourceIps.map((g) => g.groupId));
  for (const group of observationSet.aggregations.sourceIpPaths) {
    const pathRef = group.value.pathGroupRef;
    const sourceIpRef = group.value.sourceIpGroupRef;
    if (pathRef !== undefined && !pathIds.has(pathRef.groupId)) {
      throw new ObservationSetValidationError(`Dangling pathGroupRef on ${group.groupId}`);
    }
    if (sourceIpRef !== undefined && !sourceIpIds.has(sourceIpRef.groupId)) {
      throw new ObservationSetValidationError(`Dangling sourceIpGroupRef on ${group.groupId}`);
    }
  }
}

function assertTruncationArithmetic(observationSet: ObservationSet): void {
  for (const [name, view] of Object.entries(observationSet.truncation.views) as [string, ViewTruncation][]) {
    if (view.selectedGroups + view.omittedGroups !== view.totalGroups) {
      throw new ObservationSetValidationError(`Truncation arithmetic mismatch in view "${name}"`);
    }
  }
}

function assertSelectionReasonsValid(observationSet: ObservationSet): void {
  const groupsWithReasons = [
    ...observationSet.aggregations.paths,
    ...observationSet.aggregations.sourceIps,
    ...observationSet.aggregations.sourceIpPaths,
    ...observationSet.aggregations.userAgents,
  ];
  for (const group of groupsWithReasons) {
    for (const reason of group.selectionReasons) {
      if (!VALID_SELECTION_REASONS.has(reason)) {
        throw new ObservationSetValidationError(`Invalid selectionReason "${reason}" on ${group.groupId}`);
      }
    }
  }
}

/**
 * Internal invariant checks — a programming-error safety net, not a
 * data-quality gate (28 §39). Throws ObservationSetValidationError.
 */
export function validateObservationSet(observationSet: ObservationSet): void {
  if (!observationSet.schemaVersion) {
    throw new ObservationSetValidationError('schemaVersion is missing');
  }
  assertGroupIdsUnique(observationSet);
  assertReferencesValid(observationSet);
  assertTruncationArithmetic(observationSet);
  assertSelectionReasonsValid(observationSet);
  assertNoForbiddenFields(observationSet, 'observationSet');
}
