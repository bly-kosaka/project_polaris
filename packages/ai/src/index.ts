export type {
  AIExplanationInput,
  AIExplanationResult,
  AIFinding,
  AIObservationReference,
  AIUrgencyAssessment,
  PromptDocument,
  PromptPurpose,
  UrgencyLevel,
} from './types.js';

export {
  AI_EXPLANATION_SCHEMA_VERSION,
  aiExplanationModelOutputSchema,
  aiExplanationResultSchema,
  assignFindingIds,
} from './schema.js';
export type { AIExplanationModelOutput } from './schema.js';

export { INITIAL_EXPLANATION_PROMPT_VERSION } from './prompt/prompt-version.js';
export { buildInitialExplanationPrompt } from './prompt/build-initial-explanation-prompt.js';

export type { AIProvider } from './provider/ai-provider.js';
export type {
  AIModelConfig,
  AIProviderId,
  AIProviderRequest,
  AIProviderResult,
  AIProviderSelection,
  OpenAIProviderOptions,
} from './provider/provider-types.js';
export { selectProvider } from './provider/registry.js';
export type { SelectProviderOptions } from './provider/registry.js';

export { collectObservationGroupIds } from './grounding/validate-references.js';
export { validateGrounding } from './grounding/validate-explanation.js';

export { AIProviderError, GroundingValidationError } from './errors.js';
export type { AIProviderErrorCode } from './errors.js';
