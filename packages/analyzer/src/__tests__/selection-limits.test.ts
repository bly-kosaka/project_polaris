import { describe, expect, it } from 'vitest';
import type { PathAggregation } from '../aggregation/types.js';
import { selectPathGroups } from '../selection/select-path-groups.js';
import { DEFAULT_CANDIDATE_SELECTION_CONFIG } from '../selection/types.js';

function path(overrides: Partial<PathAggregation> & { path: string }): PathAggregation {
  return {
    requestCount: 1,
    distinctSourceIpCount: 1,
    distinctUserAgentCount: 1,
    queryVariantCount: 0,
    methodDistribution: [],
    statusDistribution: [],
    referrerHostDistribution: [],
    responseSize: { count: 0, total: 0, min: null, max: null, average: null },
    firstSeen: null,
    lastSeen: null,
    timeDistribution: [],
    sampleSourceIps: [],
    sampleQueries: [],
    sampleReferrers: [],
    knownInformation: [],
    ...overrides,
  };
}

describe('total limit application', () => {
  it('prioritizes Known Information matches over plain high-count groups when the total limit is exceeded', () => {
    const kiMatch = path({
      path: '/.env',
      requestCount: 1,
      knownInformation: [{ id: 'built_in.env.file', title: 'Env', source: 'built_in', isPrimary: true }],
    });
    const highCountFillers = Array.from({ length: 10 }, (_, i) => path({ path: `/busy-${i}`, requestCount: 900 - i }));

    const config = { ...DEFAULT_CANDIDATE_SELECTION_CONFIG, pathTotalLimit: 5, requestCountLimit: 20 };
    const result = selectPathGroups([kiMatch, ...highCountFillers], config);

    expect(result.selected.some((g) => g.value.path === '/.env')).toBe(true);
    expect(result.truncation.omittedGroups).toBeGreaterThan(0);
    expect(result.truncation.selectedGroups + result.truncation.omittedGroups).toBe(result.truncation.totalGroups);
  });

  it('reports totalGroups/selectedGroups/omittedGroups consistently when nothing is truncated', () => {
    const groups = [path({ path: '/a', requestCount: 5 }), path({ path: '/b', requestCount: 3 })];
    const result = selectPathGroups(groups, DEFAULT_CANDIDATE_SELECTION_CONFIG);
    expect(result.truncation).toEqual({ totalGroups: 2, selectedGroups: result.selected.length, omittedGroups: 0 });
  });

  it('counts groups never selected by any axis as omitted, not just groups cut by the total limit (30_Sprint_2_Review.md C-01)', () => {
    // 100 distinct paths, but only request_count is an active axis (limit 2)
    // and every other axis is disabled — so most paths never become a
    // candidate at all, well before the total limit (80) ever applies.
    const groups = Array.from({ length: 100 }, (_, i) =>
      path({ path: `/p${i}`, requestCount: i, distinctSourceIpCount: 0 }),
    );
    const config = {
      ...DEFAULT_CANDIDATE_SELECTION_CONFIG,
      requestCountLimit: 2,
      distinctSourceIpLimit: 0,
      distinctPathLimit: 0,
      clientErrorLimit: 0,
      serverErrorLimit: 0,
      postLimit: 0,
      responseSizeLimit: 0,
      knownInformationLimit: 0,
      representativeLimit: 1,
      pathTotalLimit: 80,
    };

    const result = selectPathGroups(groups, config);

    expect(result.selected).toHaveLength(3); // 2 from request_count + 1 representative
    expect(result.truncation).toEqual({ totalGroups: 100, selectedGroups: 3, omittedGroups: 97 });
  });

  it('holds the same invariant when the total limit IS exceeded', () => {
    const groups = Array.from({ length: 50 }, (_, i) =>
      path({ path: `/p${i}`, requestCount: 1000 - i, distinctSourceIpCount: 0 }),
    );
    const config = {
      ...DEFAULT_CANDIDATE_SELECTION_CONFIG,
      requestCountLimit: 40,
      distinctSourceIpLimit: 0,
      distinctPathLimit: 0,
      clientErrorLimit: 0,
      serverErrorLimit: 0,
      postLimit: 0,
      responseSizeLimit: 0,
      knownInformationLimit: 0,
      representativeLimit: 0,
      pathTotalLimit: 10,
    };

    const result = selectPathGroups(groups, config);

    expect(result.selected).toHaveLength(10);
    expect(result.truncation).toEqual({ totalGroups: 50, selectedGroups: 10, omittedGroups: 40 });
  });
});
