import { describe, expect, it } from 'vitest';
import { analyzeAccessLog } from '../analyze.js';
import { linesFrom } from './test-helpers.js';

describe('Fatal contract (28 §38.1)', () => {
  it('a failed analysis has no observationSet key at all', async () => {
    const result = await analyzeAccessLog(linesFrom(['this is not an access log line', 'nor is this']));

    expect(result.analyzerStatus).toBe('failed');
    if (result.analyzerStatus !== 'failed') throw new Error('unreachable');
    expect(result.errorCode).toBe('PARSER_NO_VALID_LINES');
    expect('observationSet' in result).toBe(false);

    // Compile-time check: TypeScript must refuse to let us read observationSet
    // on the failed branch without narrowing first.
    if (result.analyzerStatus === 'failed') {
      // @ts-expect-error observationSet does not exist on the failed branch
      const _shouldNotCompile = result.observationSet;
      void _shouldNotCompile;
    }
  });

  it('carries the ParseSummary even on failure, for diagnosability', async () => {
    const result = await analyzeAccessLog(linesFrom(['garbage']));
    if (result.analyzerStatus !== 'failed') throw new Error('unreachable');
    expect(result.parseSummary?.totalLines).toBe(1);
    expect(result.parseSummary?.failedLines).toBe(1);
  });
});
