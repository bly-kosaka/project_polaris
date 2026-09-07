import { z } from 'zod';

/**
 * The frontend's own Zod schema for the AI Explanation wire response — not a
 * type-only import of `@polaris/ai`'s domain types, same "own toolchain"
 * rule as `schemas.ts`'s ObservationSet schema (40_Sprint_5_Plan_Review.md
 * F-02).
 */

export const urgencyLevelSchema = z.enum(['low', 'normal', 'high', 'immediate']);

const aiReferenceSchema = z.object({ groupId: z.string() });

const aiUrgencyAssessmentSchema = z.object({
  level: urgencyLevelSchema,
  reason: z.string(),
  references: z.array(aiReferenceSchema),
  limitations: z.array(z.string()),
});

const aiFindingSchema = z.object({
  id: z.string(),
  title: z.string(),
  observation: z.string(),
  interpretation: z.string().optional(),
  limitation: z.string().optional(),
  nextChecks: z.array(z.string()),
  references: z.array(aiReferenceSchema),
});

export const aiExplanationDetailSchema = z.object({
  summary: z.string(),
  overallUrgency: aiUrgencyAssessmentSchema,
  findings: z.array(aiFindingSchema),
  overallNotes: z.array(z.string()),
  dataLimitations: z.array(z.string()),
  provider: z.string(),
  model: z.string(),
  promptVersion: z.string(),
  createdAt: z.string(),
});

export type AIExplanationDetailDto = z.infer<typeof aiExplanationDetailSchema>;
export type AIFindingDto = z.infer<typeof aiFindingSchema>;
export type AIUrgencyAssessmentDto = z.infer<typeof aiUrgencyAssessmentSchema>;
export type AIReferenceDto = z.infer<typeof aiReferenceSchema>;
