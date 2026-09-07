import type { ObservationSet } from '@polaris/analyzer';
import { GroundingValidationError } from '../errors.js';
import type { AIExplanationResult, AIObservationReference } from '../types.js';
import { collectObservationGroupIds } from './validate-references.js';

function assertReferencesResolve(
  references: AIObservationReference[],
  groupIds: Set<string>,
  context: string,
): void {
  for (const reference of references) {
    if (!groupIds.has(reference.groupId)) {
      throw new GroundingValidationError(`${context} references an unknown groupId: ${reference.groupId}`);
    }
  }
}

/**
 * The semantic/cross-field validation stage — deliberately separate from
 * `schema.ts`'s structural Zod validation (§6's pipeline keeps "Schema
 * Validation" and "Grounding Validation" as two stages). Never mutates,
 * drops, or "fixes" the result — any violation rejects the whole result
 * (§39-40).
 */
export function validateGrounding(result: AIExplanationResult, observationSet: ObservationSet): void {
  if (result.summary.trim().length === 0) {
    throw new GroundingValidationError('summary must not be empty');
  }

  const groupIds = collectObservationGroupIds(observationSet);

  for (const finding of result.findings) {
    if (finding.title.trim().length === 0) {
      throw new GroundingValidationError(`Finding ${finding.id} has an empty title`);
    }
    if (finding.observation.trim().length === 0) {
      throw new GroundingValidationError(`Finding ${finding.id} has an empty observation`);
    }
    if (finding.references.length === 0) {
      throw new GroundingValidationError(`Finding ${finding.id} has no references`);
    }
    assertReferencesResolve(finding.references, groupIds, `Finding ${finding.id}`);
  }

  if (result.overallUrgency.reason.trim().length === 0) {
    throw new GroundingValidationError('overallUrgency.reason must not be empty');
  }

  // findings.length === 0 -> overallUrgency.references may be empty; only
  // required once there is at least one Finding to ground it against (§20).
  if (result.findings.length > 0 && result.overallUrgency.references.length === 0) {
    throw new GroundingValidationError('overallUrgency must have at least one reference when findings exist');
  }
  assertReferencesResolve(result.overallUrgency.references, groupIds, 'overallUrgency');
}
