import { describe, expect, it } from 'vitest';
import { GroundingValidationError } from '../errors.js';
import { validateGrounding } from '../grounding/validate-explanation.js';
import type { AIExplanationResult } from '../types.js';
import { emptyObservationSet, observationSetWithOnePathGroup } from './fixtures.js';

const REAL_GROUP_ID = 'path:aaaaaaaaaaaaaaaa';

function baseResult(overrides: Partial<AIExplanationResult> = {}): AIExplanationResult {
  return {
    summary: 'A short summary.',
    overallUrgency: {
      level: 'normal',
      reason: 'Nothing unusual observed.',
      references: [{ groupId: REAL_GROUP_ID }],
      limitations: [],
    },
    findings: [
      {
        id: 'finding-1',
        title: 'Repeated 404s',
        observation: 'Several requests returned 404.',
        nextChecks: ['Check the referenced Path.'],
        references: [{ groupId: REAL_GROUP_ID }],
      },
    ],
    overallNotes: [],
    dataLimitations: [],
    ...overrides,
  };
}

describe('validateGrounding', () => {
  it('passes when every reference resolves to an existing groupId', () => {
    const observationSet = observationSetWithOnePathGroup(REAL_GROUP_ID);
    expect(() => validateGrounding(baseResult(), observationSet)).not.toThrow();
  });

  it('fails when a Finding references a nonexistent groupId', () => {
    const observationSet = observationSetWithOnePathGroup(REAL_GROUP_ID);
    const result = baseResult({
      findings: [{ ...baseResult().findings[0]!, references: [{ groupId: 'path:does-not-exist' }] }],
    });
    expect(() => validateGrounding(result, observationSet)).toThrow(GroundingValidationError);
  });

  it('fails when a Finding has no references at all', () => {
    const observationSet = observationSetWithOnePathGroup(REAL_GROUP_ID);
    const result = baseResult({ findings: [{ ...baseResult().findings[0]!, references: [] }] });
    expect(() => validateGrounding(result, observationSet)).toThrow(GroundingValidationError);
  });

  it('fails when overallUrgency references a nonexistent groupId', () => {
    const observationSet = observationSetWithOnePathGroup(REAL_GROUP_ID);
    const result = baseResult({
      overallUrgency: { ...baseResult().overallUrgency, references: [{ groupId: 'path:does-not-exist' }] },
    });
    expect(() => validateGrounding(result, observationSet)).toThrow(GroundingValidationError);
  });

  it('fails when findings exist but overallUrgency has no references', () => {
    const observationSet = observationSetWithOnePathGroup(REAL_GROUP_ID);
    const result = baseResult({ overallUrgency: { ...baseResult().overallUrgency, references: [] } });
    expect(() => validateGrounding(result, observationSet)).toThrow(GroundingValidationError);
  });

  it('passes with zero findings and empty overallUrgency references (§20 exception)', () => {
    const observationSet = emptyObservationSet();
    const result = baseResult({
      findings: [],
      overallUrgency: { level: 'low', reason: 'No findings were selected for explanation.', references: [], limitations: [] },
    });
    expect(() => validateGrounding(result, observationSet)).not.toThrow();
  });

  it('fails on an empty summary', () => {
    const observationSet = observationSetWithOnePathGroup(REAL_GROUP_ID);
    expect(() => validateGrounding(baseResult({ summary: '   ' }), observationSet)).toThrow(GroundingValidationError);
  });

  it('fails on an empty overallUrgency.reason', () => {
    const observationSet = observationSetWithOnePathGroup(REAL_GROUP_ID);
    const result = baseResult({ overallUrgency: { ...baseResult().overallUrgency, reason: '' } });
    expect(() => validateGrounding(result, observationSet)).toThrow(GroundingValidationError);
  });
});
