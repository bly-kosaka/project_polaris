import type { ObservationSet } from '@polaris/analyzer';

/**
 * `ObservationSet` is the only analysis input — never Raw Access Log,
 * Storage, or Analyzer internals (44_Development_Setup_and_Sixth_Sprint.md
 * §10-11). `analyzerErrors`/`analyzerWarnings` from the older 06/09 design
 * are deliberately not duplicated here — Parse Warning / Limitation /
 * Truncation / Exclusion already live inside `observationSet` itself.
 */
export interface AIExplanationInput {
  analysisId: string;
  analyzerStatus: 'success' | 'partial';
  observationSet: ObservationSet;
}

export type PromptPurpose = 'initial_summary';

export interface PromptDocument {
  systemPrompt: string;
  userPrompt: string;
  promptVersion: string;
}

/**
 * `{ groupId }` only, never a duplicated `path`/`sourceIp`/`groupType` —
 * Application code resolves the actual value from the ObservationSet by
 * `groupId` (§19). Deliberately a distinct type from
 * `@polaris/analyzer`'s same-named `ObservationReference` (which carries a
 * `groupType` and serves a different, Analyzer-internal cross-referencing
 * purpose) — never interchange the two.
 */
export interface AIObservationReference {
  groupId: string;
}

export type UrgencyLevel = 'low' | 'normal' | 'high' | 'immediate';

/**
 * Never a numeric score, never Severity/Risk — "how soon should a human
 * check this," nothing more (§16).
 */
export interface AIUrgencyAssessment {
  level: UrgencyLevel;
  reason: string;
  references: AIObservationReference[];
  limitations: string[];
}

/**
 * No Severity/Priority/Urgency at the Finding level — only `overallUrgency`
 * exists (§15).
 */
export interface AIFinding {
  id: string;
  title: string;
  observation: string;
  interpretation?: string;
  limitation?: string;
  nextChecks: string[];
  references: AIObservationReference[];
}

export interface AIExplanationResult {
  summary: string;
  overallUrgency: AIUrgencyAssessment;
  findings: AIFinding[];
  overallNotes: string[];
  dataLimitations: string[];
}
