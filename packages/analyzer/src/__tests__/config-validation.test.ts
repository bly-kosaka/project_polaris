import { describe, expect, it } from 'vitest';
import { analyzeAccessLog } from '../analyze.js';
import { isNonNegativeInteger, validateResolvedConfig } from '../config-validation.js';
import { DEFAULT_AGGREGATION_CONFIG } from '../aggregation/types.js';
import { DEFAULT_CANDIDATE_SELECTION_CONFIG } from '../selection/types.js';
import type { CandidateSelectionConfig } from '../selection/types.js';
import { linesFrom, SAMPLE_LOG_LINES } from './test-helpers.js';

const ALL_ZERO_SELECTION_CONFIG: CandidateSelectionConfig = {
  requestCountLimit: 0,
  distinctSourceIpLimit: 0,
  distinctPathLimit: 0,
  clientErrorLimit: 0,
  serverErrorLimit: 0,
  postLimit: 0,
  responseSizeLimit: 0,
  representativeLimit: 0,
  knownInformationLimit: 0,
  pathTotalLimit: 0,
  sourceIpTotalLimit: 0,
  sourceIpPathTotalLimit: 0,
  userAgentTotalLimit: 0,
  statusTotalLimit: 0,
  methodTotalLimit: 0,
  time1mLimit: 0,
  time5mLimit: 0,
};

describe('isNonNegativeInteger', () => {
  it.each([
    [-1, false],
    [Number.NaN, false],
    [Number.POSITIVE_INFINITY, false],
    [Number.NEGATIVE_INFINITY, false],
    [1.5, false],
    [0, true],
    [1, true],
    [1000, true],
  ])('%s -> %s', (value, expected) => {
    expect(isNonNegativeInteger(value)).toBe(expected);
  });
});

describe('validateResolvedConfig', () => {
  const valid = { aggregation: DEFAULT_AGGREGATION_CONFIG, selection: DEFAULT_CANDIDATE_SELECTION_CONFIG };

  it('accepts the defaults without throwing', () => {
    expect(() => validateResolvedConfig(valid)).not.toThrow();
  });

  it('accepts 0 for every field — no blanket >0 rule', () => {
    expect(() =>
      validateResolvedConfig({
        aggregation: { sampleLimit: 0, topPathLimit: 0, topSourceIpLimit: 0 },
        selection: ALL_ZERO_SELECTION_CONFIG,
      }),
    ).not.toThrow();
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5])(
    'rejects %s for an aggregation field',
    (bad) => {
      expect(() =>
        validateResolvedConfig({
          aggregation: { ...DEFAULT_AGGREGATION_CONFIG, sampleLimit: bad },
          selection: DEFAULT_CANDIDATE_SELECTION_CONFIG,
        }),
      ).toThrow();
    },
  );

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5])(
    'rejects %s for a selection field',
    (bad) => {
      expect(() =>
        validateResolvedConfig({
          aggregation: DEFAULT_AGGREGATION_CONFIG,
          selection: { ...DEFAULT_CANDIDATE_SELECTION_CONFIG, requestCountLimit: bad },
        }),
      ).toThrow();
    },
  );

  it('never includes the invalid value in the thrown message', () => {
    try {
      validateResolvedConfig({
        aggregation: { ...DEFAULT_AGGREGATION_CONFIG, sampleLimit: -999999 },
        selection: DEFAULT_CANDIDATE_SELECTION_CONFIG,
      });
      throw new Error('expected validateResolvedConfig to throw');
    } catch (error) {
      expect(String(error)).not.toContain('999999');
      expect(String(error)).toContain('sampleLimit');
    }
  });
});

describe('analyzeAccessLog with an invalid config', () => {
  it('fails with ANALYZER_INVALID_CONFIGURATION and never starts parsing', async () => {
    let iterated = false;
    async function* throwingIfIterated(): AsyncGenerator<string> {
      iterated = true;
      yield 'unreachable';
    }

    const result = await analyzeAccessLog(throwingIfIterated(), {
      aggregation: { sampleLimit: -1 },
    });

    expect(result).toEqual({ analyzerStatus: 'failed', errorCode: 'ANALYZER_INVALID_CONFIGURATION' });
    expect('observationSet' in result).toBe(false);
    expect('parseSummary' in result).toBe(false);
    expect(iterated).toBe(false); // the streaming parse must never have started
  });

  it('fails for an invalid selection config field too', async () => {
    const result = await analyzeAccessLog(linesFrom(SAMPLE_LOG_LINES), {
      selection: { time1mLimit: Number.NaN },
    });
    expect(result.analyzerStatus).toBe('failed');
    if (result.analyzerStatus !== 'failed') throw new Error('unreachable');
    expect(result.errorCode).toBe('ANALYZER_INVALID_CONFIGURATION');
  });

  it('still succeeds when every limit is explicitly 0 (regression guard against a blanket >0 rule)', async () => {
    const result = await analyzeAccessLog(linesFrom(SAMPLE_LOG_LINES), {
      aggregation: { sampleLimit: 0, topPathLimit: 0, topSourceIpLimit: 0 },
      selection: ALL_ZERO_SELECTION_CONFIG,
    });

    expect(result.analyzerStatus).not.toBe('failed');
  });
});
