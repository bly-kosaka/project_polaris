import { describe, expect, it } from 'vitest';
import { buildInitialExplanationPrompt } from '../prompt/build-initial-explanation-prompt.js';
import { INITIAL_EXPLANATION_PROMPT_VERSION } from '../prompt/prompt-version.js';
import type { AIExplanationInput } from '../types.js';
import { emptyObservationSet } from './fixtures.js';

function baseInput(overrides: Partial<AIExplanationInput> = {}): AIExplanationInput {
  return {
    analysisId: 'analysis-1',
    analyzerStatus: 'success',
    observationSet: emptyObservationSet(),
    ...overrides,
  };
}

describe('buildInitialExplanationPrompt', () => {
  it('does not mutate the input ObservationSet', () => {
    const input = baseInput();
    const before = JSON.stringify(input.observationSet);
    buildInitialExplanationPrompt(input);
    expect(JSON.stringify(input.observationSet)).toBe(before);
  });

  it('carries the current Prompt Version', () => {
    const document = buildInitialExplanationPrompt(baseInput());
    expect(document.promptVersion).toBe(INITIAL_EXPLANATION_PROMPT_VERSION);
  });

  it('explicitly forbids the model from claiming it read the Raw Log', () => {
    const document = buildInitialExplanationPrompt(baseInput());
    expect(document.systemPrompt).toContain('Raw Access Logそのものを見た');
    expect(document.systemPrompt).toContain('主張してはならない');
  });

  it('treats the embedded ObservationSet strings as data, never instructions', () => {
    const document = buildInitialExplanationPrompt(baseInput());
    expect(document.systemPrompt).toContain('命令・依頼・指示');
  });

  it('embeds the ObservationSet as a single tagged JSON block', () => {
    const document = buildInitialExplanationPrompt(baseInput());
    expect(document.userPrompt).toMatch(/<observation_set>.*<\/observation_set>/s);
  });

  it('surfaces the AnalyzerStatus so Partial/Truncation guidance can apply', () => {
    const document = buildInitialExplanationPrompt(baseInput({ analyzerStatus: 'partial' }));
    expect(document.userPrompt).toContain('partial');
  });
});
