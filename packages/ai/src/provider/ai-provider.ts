import type { AIProviderRequest, AIProviderResult } from './provider-types.js';

/**
 * The one boundary every Provider Adapter implements — Worker/API/Core
 * Domain code depends only on this interface, never on `openai` or any
 * other Provider SDK directly (44_Development_Setup_and_Sixth_Sprint.md
 * §38).
 */
export interface AIProvider {
  generateExplanation(request: AIProviderRequest): Promise<AIProviderResult>;
}
