import { describe, expect, it } from 'vitest';
import { aiExplanationModelOutputSchema, aiExplanationResultSchema, assignFindingIds } from '../schema.js';

function validModelOutput() {
  return {
    summary: 'A short summary.',
    overallUrgency: {
      level: 'normal' as const,
      reason: 'Nothing unusual observed.',
      references: [{ groupId: 'path:aaaa' }],
      limitations: [],
    },
    findings: [
      {
        title: 'Repeated 404s',
        observation: 'Several requests returned 404.',
        interpretation: 'Possibly a broken link.',
        limitation: null,
        nextChecks: ['Check the referenced Path.'],
        references: [{ groupId: 'path:aaaa' }],
      },
    ],
    overallNotes: [],
    dataLimitations: [],
  };
}

describe('aiExplanationModelOutputSchema', () => {
  it('accepts a valid model output', () => {
    expect(aiExplanationModelOutputSchema.safeParse(validModelOutput()).success).toBe(true);
  });

  it('rejects an invalid urgency level', () => {
    const output = validModelOutput();
    output.overallUrgency = { ...output.overallUrgency, level: 'critical' as never };
    expect(aiExplanationModelOutputSchema.safeParse(output).success).toBe(false);
  });

  it('rejects a Finding with no references', () => {
    const output = validModelOutput();
    output.findings[0]!.references = [];
    // Zod's structural schema allows an empty array — emptiness is a
    // Grounding Validation concern (see grounding.test.ts), not a schema
    // concern. Confirm the schema itself still parses (structural only).
    expect(aiExplanationModelOutputSchema.safeParse(output).success).toBe(true);
  });

  it('rejects empty required text fields structurally missing altogether', () => {
    const { summary: _omit, ...withoutSummary } = validModelOutput();
    expect(aiExplanationModelOutputSchema.safeParse(withoutSummary).success).toBe(false);
  });

  it('rejects a Finding carrying an `id` field the model should never supply', () => {
    // Not literally rejected by Zod (unknown keys are ignored by default),
    // but confirms `id` is not part of the schema shape at all.
    const parsed = aiExplanationModelOutputSchema.parse(validModelOutput());
    expect(parsed.findings[0]).not.toHaveProperty('id');
  });
});

describe('assignFindingIds', () => {
  it('assigns finding-1, finding-2, ... in the model’s own returned order', () => {
    const output = validModelOutput();
    output.findings.push({ ...output.findings[0]!, title: 'Second finding' });
    const parsed = aiExplanationModelOutputSchema.parse(output);
    const result = assignFindingIds(parsed);
    expect(result.findings.map((f) => f.id)).toEqual(['finding-1', 'finding-2']);
    expect(result.findings[1]!.title).toBe('Second finding');
  });

  it('converts nullable strict-mode fields to undefined', () => {
    const parsed = aiExplanationModelOutputSchema.parse(validModelOutput());
    const result = assignFindingIds(parsed);
    expect(result.findings[0]!.limitation).toBeUndefined();
    expect(result.findings[0]!.interpretation).toBe('Possibly a broken link.');
  });

  it('the result validates against the domain schema once IDs are assigned', () => {
    const parsed = aiExplanationModelOutputSchema.parse(validModelOutput());
    const result = assignFindingIds(parsed);
    expect(aiExplanationResultSchema.safeParse(result).success).toBe(true);
  });
});

describe('aiExplanationResultSchema', () => {
  it('requires every Finding to carry an id', () => {
    const parsed = aiExplanationModelOutputSchema.parse(validModelOutput());
    const result = assignFindingIds(parsed);
    const { id: _omit, ...withoutId } = result.findings[0]!;
    const invalid = { ...result, findings: [withoutId] };
    expect(aiExplanationResultSchema.safeParse(invalid).success).toBe(false);
  });
});
