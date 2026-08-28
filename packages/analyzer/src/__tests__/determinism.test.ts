import { describe, expect, it } from 'vitest';
import { analyzeAccessLog } from '../analyze.js';
import { linesFrom, SAMPLE_LOG_LINES } from './test-helpers.js';

describe('Determinism (28 §49)', () => {
  it('two independent runs on identical input/config produce a byte-identical ObservationSet', async () => {
    const first = await analyzeAccessLog(linesFrom(SAMPLE_LOG_LINES));
    const second = await analyzeAccessLog(linesFrom(SAMPLE_LOG_LINES));

    expect(first.analyzerStatus).not.toBe('failed');
    expect(second.analyzerStatus).not.toBe('failed');
    if (first.analyzerStatus === 'failed' || second.analyzerStatus === 'failed') throw new Error('unreachable');

    expect(JSON.stringify(first.observationSet)).toBe(JSON.stringify(second.observationSet));
  });

  it('remains deterministic across many repeated runs, not just two', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => analyzeAccessLog(linesFrom(SAMPLE_LOG_LINES))),
    );
    const serialized = results.map((r) => JSON.stringify(r));
    expect(new Set(serialized).size).toBe(1);
  });
});
