import { describe, expect, it } from 'vitest';
import { AggregationEngine } from '../aggregation/aggregation-engine.js';
import type { NormalizedAccessLogEntry } from '../types/normalized-entry.js';

const entries: NormalizedAccessLogEntry[] = [
  {
    timestamp: '2023-10-10T17:00:00.000Z',
    sourceIp: '192.0.2.10',
    method: 'GET',
    path: '/popular.html',
    status: 200,
    responseBytes: 1024,
  },
  {
    timestamp: '2023-10-10T17:00:30.000Z',
    sourceIp: '192.0.2.10',
    method: 'GET',
    path: '/popular.html',
    status: 200,
    responseBytes: 1024,
  },
  {
    timestamp: '2023-10-10T17:00:45.000Z',
    sourceIp: '198.51.100.20',
    method: 'GET',
    path: '/popular.html',
    status: 200,
    responseBytes: 1024,
  },
  {
    timestamp: '2023-10-10T17:06:00.000Z',
    sourceIp: '192.0.2.10',
    method: 'POST',
    path: '/contact',
    status: 500,
    responseBytes: 128,
  },
];

describe('AggregationEngine', () => {
  it('produces correct Path requestCount and distinct counts', () => {
    const engine = new AggregationEngine();
    for (const entry of entries) engine.consume(entry);
    const set = engine.build();

    const popular = set.paths.find((p) => p.path === '/popular.html');
    expect(popular?.requestCount).toBe(3);
    expect(popular?.distinctSourceIpCount).toBe(2);
    expect(popular?.firstSeen).toBe('2023-10-10T17:00:00.000Z');
    expect(popular?.lastSeen).toBe('2023-10-10T17:00:45.000Z');
  });

  it('produces correct Source IP requestCount and distinctPathCount', () => {
    const engine = new AggregationEngine();
    for (const entry of entries) engine.consume(entry);
    const set = engine.build();

    const ip = set.sourceIps.find((s) => s.sourceIp === '192.0.2.10');
    expect(ip?.requestCount).toBe(3);
    expect(ip?.distinctPathCount).toBe(2);
  });

  it('produces correct Source IP x Path requestCount', () => {
    const engine = new AggregationEngine();
    for (const entry of entries) engine.consume(entry);
    const set = engine.build();

    const pair = set.sourceIpPaths.find((sp) => sp.sourceIp === '192.0.2.10' && sp.path === '/popular.html');
    expect(pair?.requestCount).toBe(2);
  });

  it('produces correct Status and Method counts', () => {
    const engine = new AggregationEngine();
    for (const entry of entries) engine.consume(entry);
    const set = engine.build();

    expect(set.statuses.find((s) => s.status === 200)?.requestCount).toBe(3);
    expect(set.statuses.find((s) => s.status === 500)?.requestCount).toBe(1);
    expect(set.methods.find((m) => m.method === 'GET')?.requestCount).toBe(3);
    expect(set.methods.find((m) => m.method === 'POST')?.requestCount).toBe(1);
  });

  it('buckets 1-minute and 5-minute time views independently', () => {
    const engine = new AggregationEngine();
    for (const entry of entries) engine.consume(entry);
    const set = engine.build();

    // Three requests fall in [17:00:00, 17:01:00), one in [17:06:00, 17:07:00)
    expect(set.timeBuckets.oneMinute).toHaveLength(2);
    expect(set.timeBuckets.oneMinute.find((b) => b.bucketStart === '2023-10-10T17:00:00.000Z')?.requestCount).toBe(
      3,
    );

    // Five-minute buckets: [17:00,17:05) and [17:05,17:10)
    expect(set.timeBuckets.fiveMinute).toHaveLength(2);
    expect(set.timeBuckets.fiveMinute.find((b) => b.bucketStart === '2023-10-10T17:00:00.000Z')?.requestCount).toBe(
      3,
    );
  });

  it('skips entries missing sourceIp for the Source IP view rather than bucketing them as "unknown"', () => {
    const engine = new AggregationEngine();
    engine.consume({ path: '/no-ip.html', method: 'GET', status: 200 });
    const set = engine.build();

    expect(set.sourceIps).toHaveLength(0);
    expect(set.paths.find((p) => p.path === '/no-ip.html')?.requestCount).toBe(1);
  });

  it('never accumulates NormalizedAccessLogEntry[] itself — AggregationEngine exposes no such accessor', () => {
    const engine = new AggregationEngine();
    expect((engine as unknown as Record<string, unknown>).entries).toBeUndefined();
  });
});
