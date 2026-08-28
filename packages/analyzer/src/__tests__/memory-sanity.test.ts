import { describe, expect, it } from 'vitest';
import { analyzeAccessLog } from '../analyze.js';
import { AggregationEngine } from '../aggregation/aggregation-engine.js';
import { DEFAULT_AGGREGATION_CONFIG } from '../aggregation/types.js';

async function* generateSyntheticLines(count: number): AsyncGenerator<string> {
  // A handful of source IPs and one hot path with many distinct query
  // variants — the scenario that would blow up an unbounded sample store.
  const ips = ['192.0.2.10', '192.0.2.11', '198.51.100.20', '198.51.100.21', '203.0.113.30'];
  for (let i = 0; i < count; i += 1) {
    const ip = ips[i % ips.length];
    yield `${ip} - - [10/Oct/2023:17:00:${String(i % 60).padStart(2, '0')} +0000] "GET /search?q=variant-${i} HTTP/1.1" 200 512 "-" "Mozilla/5.0"`;
  }
}

describe('Memory sanity', () => {
  it('sample fields never exceed their configured cap, even under 50,000 distinct query variants', async () => {
    const lineCount = 50_000;
    const result = await analyzeAccessLog(generateSyntheticLines(lineCount));

    expect(result.analyzerStatus).not.toBe('failed');
    if (result.analyzerStatus === 'failed') throw new Error('unreachable');

    for (const group of result.observationSet.aggregations.paths) {
      expect(group.value.sampleQueries.length).toBeLessThanOrEqual(DEFAULT_AGGREGATION_CONFIG.sampleLimit);
      expect(group.value.sampleSourceIps.length).toBeLessThanOrEqual(DEFAULT_AGGREGATION_CONFIG.sampleLimit);
      expect(group.value.sampleReferrers.length).toBeLessThanOrEqual(DEFAULT_AGGREGATION_CONFIG.sampleLimit);
    }

    // distinct-count cardinality is explicitly allowed to be exact and large —
    // only the sample lists are bounded.
    const hotPath = result.observationSet.aggregations.paths.find((g) => g.value.path === '/search');
    expect(hotPath?.value.queryVariantCount).toBe(lineCount);
  });

  it('AggregationEngine exposes no accessor returning the full entry list', () => {
    const engine = new AggregationEngine();
    for (let i = 0; i < 1000; i += 1) {
      engine.consume({ path: '/x', sourceIp: '192.0.2.1', method: 'GET', status: 200 });
    }
    const anyEngine = engine as unknown as Record<string, unknown>;
    expect(anyEngine.entries).toBeUndefined();
    expect(anyEngine.rawEntries).toBeUndefined();
  });
}, 30_000);
