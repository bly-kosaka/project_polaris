import { z } from 'zod';
import type { AIExplanationResult, AIFinding } from './types.js';

export const AI_EXPLANATION_SCHEMA_VERSION = '1.0.0';

const urgencyLevelSchema = z.enum(['low', 'normal', 'high', 'immediate']);

const aiObservationReferenceSchema = z.object({ groupId: z.string() });

/**
 * The shape sent to OpenAI via `zodTextFormat` (provider/providers/openai).
 * Strict-mode Structured Outputs require every property to appear in
 * `required` — optional fields are expressed as `.nullable()`, not
 * `.optional()`, and Findings carry **no `id`** (the model never invents
 * one; `assignFindingIds()` below assigns `finding-1`, `finding-2`, ... in
 * returned order — 44_Development_Setup_and_Sixth_Sprint.md §18).
 */
const modelFindingSchema = z.object({
  title: z.string(),
  observation: z.string(),
  interpretation: z.string().nullable(),
  limitation: z.string().nullable(),
  nextChecks: z.array(z.string()),
  references: z.array(aiObservationReferenceSchema),
});

const modelUrgencySchema = z.object({
  level: urgencyLevelSchema,
  reason: z.string(),
  references: z.array(aiObservationReferenceSchema),
  limitations: z.array(z.string()),
});

export const aiExplanationModelOutputSchema = z.object({
  summary: z.string(),
  overallUrgency: modelUrgencySchema,
  findings: z.array(modelFindingSchema),
  overallNotes: z.array(z.string()),
  dataLimitations: z.array(z.string()),
});

export type AIExplanationModelOutput = z.infer<typeof aiExplanationModelOutputSchema>;

/**
 * Validates the **domain** shape (with `id` present on every Finding) —
 * what `packages/db`'s deserialize step and any DB round-trip re-validate
 * against (§47: "unknown -> Schema -> Domain," never a bare `as
 * AIExplanationResult` cast).
 */
const domainFindingSchema = z.object({
  id: z.string(),
  title: z.string(),
  observation: z.string(),
  interpretation: z.string().optional(),
  limitation: z.string().optional(),
  nextChecks: z.array(z.string()),
  references: z.array(aiObservationReferenceSchema),
});

export const aiExplanationResultSchema = z.object({
  summary: z.string(),
  overallUrgency: modelUrgencySchema,
  findings: z.array(domainFindingSchema),
  overallNotes: z.array(z.string()),
  dataLimitations: z.array(z.string()),
});

/**
 * Pure formatter — model output to domain shape. Assigns deterministic
 * `finding-1`, `finding-2`, ... IDs in the model's own returned order
 * (never re-sorted) and converts `null -> undefined` for the
 * strict-mode-only nullable fields (§18).
 */
export function assignFindingIds(output: AIExplanationModelOutput): AIExplanationResult {
  const findings: AIFinding[] = output.findings.map((finding, index) => ({
    id: `finding-${index + 1}`,
    title: finding.title,
    observation: finding.observation,
    ...(finding.interpretation !== null ? { interpretation: finding.interpretation } : {}),
    ...(finding.limitation !== null ? { limitation: finding.limitation } : {}),
    nextChecks: finding.nextChecks,
    references: finding.references,
  }));

  return {
    summary: output.summary,
    overallUrgency: output.overallUrgency,
    findings,
    overallNotes: output.overallNotes,
    dataLimitations: output.dataLimitations,
  };
}
