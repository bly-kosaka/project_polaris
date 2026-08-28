import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeAccessLog } from '../analyze.js';
import { readLines } from '../streaming/read-lines.js';
import { validateObservationSet } from '../observation-set/validate-observation-set.js';

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../fixtures/access-logs',
);

function fixture(name: string): string {
  return path.join(fixturesDir, name);
}

describe('analyzeAccessLog — full pipeline integration', () => {
  it('produces a valid ObservationSet for valid.log', async () => {
    const result = await analyzeAccessLog(readLines(fixture('valid.log')));
    expect(result.analyzerStatus).toBe('success');
    if (result.analyzerStatus === 'failed') throw new Error('unreachable');
    expect(() => validateObservationSet(result.observationSet)).not.toThrow();
  });

  it('produces a valid ObservationSet for partial.log with analyzerStatus partial', async () => {
    const result = await analyzeAccessLog(readLines(fixture('partial.log')));
    expect(result.analyzerStatus).toBe('partial');
    if (result.analyzerStatus === 'failed') throw new Error('unreachable');
    expect(() => validateObservationSet(result.observationSet)).not.toThrow();
  });

  it('returns failed with no observationSet for invalid.log', async () => {
    const result = await analyzeAccessLog(readLines(fixture('invalid.log')));
    expect(result.analyzerStatus).toBe('failed');
    if (result.analyzerStatus !== 'failed') throw new Error('unreachable');
    expect(result.errorCode).toBe('PARSER_NO_VALID_LINES');
    expect('observationSet' in result).toBe(false);
  });

  it('annotates all four built-in Known Information paths for known-information.log', async () => {
    const result = await analyzeAccessLog(readLines(fixture('known-information.log')));
    if (result.analyzerStatus === 'failed') throw new Error('unreachable');

    const matchedIds = result.observationSet.knownInformation.matchedEntryIds;
    expect(matchedIds).toEqual(
      expect.arrayContaining([
        'built_in.wordpress.login',
        'built_in.wordpress.xmlrpc',
        'built_in.git.directory',
        'built_in.env.file',
      ]),
    );
  });

  it('excludes a configured path from Aggregation while recording it in ExclusionSummary', async () => {
    const result = await analyzeAccessLog(readLines(fixture('aggregation.log')), {
      exclusion: { rules: [{ id: 'exclude-health-check', target: 'path', matchType: 'exact', value: '/internal/health-check' }] },
    });
    if (result.analyzerStatus === 'failed') throw new Error('unreachable');

    expect(result.observationSet.aggregations.paths.some((g) => g.value.path === '/internal/health-check')).toBe(
      false,
    );
    expect(result.observationSet.exclusion.excludedEntryCount).toBe(1);
    expect(result.observationSet.exclusion.byReason).toEqual([{ ruleId: 'exclude-health-check', count: 1 }]);
  });

  it('produces multi-axis selection and a valid ObservationSet for aggregation.log', async () => {
    const result = await analyzeAccessLog(readLines(fixture('aggregation.log')));
    if (result.analyzerStatus === 'failed') throw new Error('unreachable');

    expect(() => validateObservationSet(result.observationSet)).not.toThrow();
    const popular = result.observationSet.aggregations.paths.find((g) => g.value.path === '/popular.html');
    expect(popular?.selectionReasons).toContain('request_count');

    const brokenPath = result.observationSet.aggregations.paths.find((g) => g.value.path === '/missing-a.html');
    expect(brokenPath?.selectionReasons).toContain('status_4xx');
  });
});
