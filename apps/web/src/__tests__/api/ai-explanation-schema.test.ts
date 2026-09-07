import { describe, expect, it } from 'vitest';
import { aiExplanationDetailSchema } from '../../api/ai-explanation-schema';

function validPayload() {
  return {
    summary: 'summary text',
    overallUrgency: {
      level: 'normal',
      reason: 'reason text',
      references: [{ groupId: 'path:abc123' }],
      limitations: [],
    },
    findings: [
      {
        id: 'finding-1',
        title: 'Title',
        observation: 'Observed X',
        nextChecks: ['Check Y'],
        references: [{ groupId: 'path:abc123' }],
      },
    ],
    overallNotes: [],
    dataLimitations: [],
    provider: 'openai',
    model: 'fake-model',
    promptVersion: 'initial-explanation-v1',
    createdAt: '2026-01-01T00:00:00Z',
  };
}

describe('aiExplanationDetailSchema', () => {
  it('parses a valid AI Explanation response', () => {
    const result = aiExplanationDetailSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it('accepts optional interpretation/limitation on a Finding', () => {
    const payload = validPayload();
    payload.findings[0] = { ...payload.findings[0], interpretation: 'maybe X', limitation: 'unclear Y' } as never;
    const result = aiExplanationDetailSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('rejects a missing summary', () => {
    const payload = validPayload() as Record<string, unknown>;
    delete payload.summary;
    const result = aiExplanationDetailSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid urgency level', () => {
    const payload = validPayload();
    payload.overallUrgency.level = 'extreme' as never;
    const result = aiExplanationDetailSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects a Finding missing required fields', () => {
    const payload = validPayload() as { findings: Array<Record<string, unknown>> };
    delete payload.findings[0]!.observation;
    const result = aiExplanationDetailSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('accepts zero findings', () => {
    const payload = validPayload();
    payload.findings = [];
    const result = aiExplanationDetailSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});
