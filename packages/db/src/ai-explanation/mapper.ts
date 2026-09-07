import { aiExplanationResultSchema, type AIExplanationResult, type AIFinding } from '@polaris/ai';
import type { AIExplanationRecord as PrismaAIExplanationRecord } from '../generated/prisma/client.js';
import type { AIExplanationRecord } from './types.js';

/**
 * Zod's `.optional()` infers `T | undefined`, which
 * `exactOptionalPropertyTypes` doesn't consider assignable to a
 * hand-written `field?: T` domain type — re-map field-by-field rather than
 * trusting the parsed shape directly, same conditional-spread pattern used
 * throughout this codebase's other domain mappers.
 */
function toDomainFinding(finding: ReturnType<typeof aiExplanationResultSchema.parse>['findings'][number]): AIFinding {
  return {
    id: finding.id,
    title: finding.title,
    observation: finding.observation,
    ...(finding.interpretation !== undefined ? { interpretation: finding.interpretation } : {}),
    ...(finding.limitation !== undefined ? { limitation: finding.limitation } : {}),
    nextChecks: finding.nextChecks,
    references: finding.references,
  };
}

/**
 * `data` is stored as JSON and re-typed here — always re-validated before
 * being trusted, never a bare cast (44_Development_Setup_and_Sixth_Sprint.md
 * §47: "unknown -> Schema -> Domain," same rule
 * `toDomainObservationSetRecord()` already follows for ObservationSet).
 */
export function toDomainAiExplanationRecord(record: PrismaAIExplanationRecord): AIExplanationRecord {
  const parsed = aiExplanationResultSchema.parse(record.data);
  const data: AIExplanationResult = {
    summary: parsed.summary,
    overallUrgency: parsed.overallUrgency,
    findings: parsed.findings.map(toDomainFinding),
    overallNotes: parsed.overallNotes,
    dataLimitations: parsed.dataLimitations,
  };

  return {
    id: record.id,
    analysisId: record.analysisId,
    schemaVersion: record.schemaVersion,
    promptVersion: record.promptVersion,
    provider: record.provider,
    model: record.model,
    data,
    ...(record.providerResponseId !== null ? { providerResponseId: record.providerResponseId } : {}),
    ...(record.inputTokens !== null ? { inputTokens: record.inputTokens } : {}),
    ...(record.outputTokens !== null ? { outputTokens: record.outputTokens } : {}),
    ...(record.totalTokens !== null ? { totalTokens: record.totalTokens } : {}),
    createdAt: record.createdAt.toISOString(),
  };
}
