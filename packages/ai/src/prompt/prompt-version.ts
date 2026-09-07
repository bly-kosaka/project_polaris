/**
 * Persisted alongside every AIExplanationRecord — bump this whenever the
 * prompt text changes. A Prompt Version change never auto-regenerates
 * existing results (44_Development_Setup_and_Sixth_Sprint.md §59).
 */
export const INITIAL_EXPLANATION_PROMPT_VERSION = 'initial-explanation-v1';
