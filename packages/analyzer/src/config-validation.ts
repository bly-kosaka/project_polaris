import { AnalyzerConfigValidationError } from './errors.js';
import type { AggregationConfig } from './aggregation/types.js';
import type { CandidateSelectionConfig } from './selection/types.js';

/**
 * No blanket `>0` rule — 0 is a legal value everywhere here (it just means
 * "select nothing via this axis", already exercised by several Sprint 2
 * tests). Only integer / non-negative / finite is required
 * (31_Development_Setup_and_Third_Sprint.md §7).
 */
export function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function assertField(value: number, fieldName: string): void {
  if (!isNonNegativeInteger(value)) {
    // Never include the invalid value itself in the message — only the
    // field name crosses this boundary (same rule as mapAnalyzerFailure).
    throw new AnalyzerConfigValidationError(`${fieldName} must be a non-negative integer`);
  }
}

export function validateAggregationConfig(config: AggregationConfig): void {
  assertField(config.sampleLimit, 'aggregation.sampleLimit');
  assertField(config.topPathLimit, 'aggregation.topPathLimit');
  assertField(config.topSourceIpLimit, 'aggregation.topSourceIpLimit');
}

export function validateCandidateSelectionConfig(config: CandidateSelectionConfig): void {
  assertField(config.requestCountLimit, 'selection.requestCountLimit');
  assertField(config.distinctSourceIpLimit, 'selection.distinctSourceIpLimit');
  assertField(config.distinctPathLimit, 'selection.distinctPathLimit');
  assertField(config.clientErrorLimit, 'selection.clientErrorLimit');
  assertField(config.serverErrorLimit, 'selection.serverErrorLimit');
  assertField(config.postLimit, 'selection.postLimit');
  assertField(config.responseSizeLimit, 'selection.responseSizeLimit');
  assertField(config.representativeLimit, 'selection.representativeLimit');
  assertField(config.knownInformationLimit, 'selection.knownInformationLimit');
  assertField(config.pathTotalLimit, 'selection.pathTotalLimit');
  assertField(config.sourceIpTotalLimit, 'selection.sourceIpTotalLimit');
  assertField(config.sourceIpPathTotalLimit, 'selection.sourceIpPathTotalLimit');
  assertField(config.userAgentTotalLimit, 'selection.userAgentTotalLimit');
  assertField(config.statusTotalLimit, 'selection.statusTotalLimit');
  assertField(config.methodTotalLimit, 'selection.methodTotalLimit');
  assertField(config.time1mLimit, 'selection.time1mLimit');
  assertField(config.time5mLimit, 'selection.time5mLimit');
}

export function validateResolvedConfig(params: {
  aggregation: AggregationConfig;
  selection: CandidateSelectionConfig;
}): void {
  validateAggregationConfig(params.aggregation);
  validateCandidateSelectionConfig(params.selection);
}
