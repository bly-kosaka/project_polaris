import { describe, expect, it, vi } from 'vitest';
import { AggregationEngine } from '../aggregation/aggregation-engine.js';
import { annotateAggregationSet } from '../known-information/annotate-aggregation.js';
import { KnownInformationStore } from '../known-information/known-information-store.js';
import type { NormalizedAccessLogEntry } from '../types/normalized-entry.js';

const entries: NormalizedAccessLogEntry[] = [
  { sourceIp: '192.0.2.10', path: '/wp-login.php', method: 'GET', status: 200 },
  { sourceIp: '192.0.2.10', path: '/wp-login.php', method: 'POST', status: 200 },
  { sourceIp: '198.51.100.20', path: '/wp-login.php', method: 'GET', status: 200 },
  { sourceIp: '192.0.2.10', path: '/about.html', method: 'GET', status: 200 },
];

describe('annotateAggregationSet', () => {
  it('calls the matcher exactly once per unique aggregated path, not once per raw line', () => {
    const engine = new AggregationEngine();
    for (const entry of entries) engine.consume(entry);
    const aggregationSet = engine.build();

    const store = new KnownInformationStore([]);
    const matchSpy = vi.spyOn(store, 'matchPath');

    annotateAggregationSet(aggregationSet, store);

    // 2 distinct paths (/wp-login.php, /about.html), even though 4 lines and
    // 3 sourceIp x path rows were consumed.
    expect(matchSpy).toHaveBeenCalledTimes(2);
  });

  it('annotates the Path group directly and propagates the same match to its Source-IP x Path rows', () => {
    const engine = new AggregationEngine();
    for (const entry of entries) engine.consume(entry);
    const aggregationSet = engine.build();

    const store = new KnownInformationStore([
      { id: 'built_in.wordpress.login', target: 'path', source: 'built_in', matchType: 'exact', pattern: '/wp-login.php', title: 'WP Login' },
    ]);

    const annotated = annotateAggregationSet(aggregationSet, store);

    const pathGroup = annotated.paths.find((p) => p.path === '/wp-login.php');
    expect(pathGroup?.knownInformation).toHaveLength(1);
    expect(pathGroup?.knownInformation[0]?.id).toBe('built_in.wordpress.login');

    const sourceIpPathRows = annotated.sourceIpPaths.filter((sp) => sp.path === '/wp-login.php');
    expect(sourceIpPathRows.length).toBeGreaterThan(0);
    for (const row of sourceIpPathRows) {
      expect(row.knownInformation).toEqual(pathGroup?.knownInformation);
    }

    const unrelated = annotated.paths.find((p) => p.path === '/about.html');
    expect(unrelated?.knownInformation).toEqual([]);
  });
});
