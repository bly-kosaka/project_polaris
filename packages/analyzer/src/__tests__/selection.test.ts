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

describe('selectPathGroups', () => {
  it('keeps a Known Information match even at requestCount=1', () => {
    const groups: PathAggregation[] = [
      path({
        path: '/.git/config',
        requestCount: 1,
        knownInformation: [{ id: 'built_in.git.directory', title: 'Git', source: 'built_in', isPrimary: true }],
      }),
      ...Array.from({ length: 30 }, (_, i) => path({ path: `/high-traffic-${i}`, requestCount: 1000 - i })),
    ];

    const result = selectPathGroups(groups, DEFAULT_CANDIDATE_SELECTION_CONFIG);
    const gitConfig = result.selected.find((g) => g.value.path === '/.git/config');
    expect(gitConfig).toBeDefined();
    expect(gitConfig?.selectionReasons).toContain('known_information');
  });

  it('selects top-N by request count, 4xx, 5xx, POST, and response size', () => {
    const groups: PathAggregation[] = [
      path({ path: '/quiet', requestCount: 1 }),
      path({ path: '/busy', requestCount: 500 }),
      path({ path: '/broken', requestCount: 5, statusDistribution: [{ key: 404, count: 5 }] }),
      path({ path: '/down', requestCount: 5, statusDistribution: [{ key: 500, count: 5 }] }),
      path({ path: '/form', requestCount: 5, methodDistribution: [{ key: 'POST', count: 5 }] }),
      path({ path: '/heavy', requestCount: 5, responseSize: { count: 5, total: 1_000_000, min: 200_000, max: 200_000, average: 200_000 } }),
    ];

    const result = selectPathGroups(groups, DEFAULT_CANDIDATE_SELECTION_CONFIG);
    const reasonsByPath = new Map(result.selected.map((g) => [g.value.path, g.selectionReasons]));

    expect(reasonsByPath.get('/busy')).toContain('request_count');
    expect(reasonsByPath.get('/broken')).toContain('status_4xx');
    expect(reasonsByPath.get('/down')).toContain('status_5xx');
    expect(reasonsByPath.get('/form')).toContain('method_post');
    expect(reasonsByPath.get('/heavy')).toContain('response_size');
  });

  it('deduplicates a group selected by multiple axes into one entry with multiple reasons', () => {
    const groups: PathAggregation[] = [
      path({
        path: '/wp-login.php',
        requestCount: 500,
        methodDistribution: [{ key: 'POST', count: 500 }],
        knownInformation: [{ id: 'built_in.wordpress.login', title: 'WP Login', source: 'built_in', isPrimary: true }],
      }),
      ...Array.from({ length: 5 }, (_, i) => path({ path: `/other-${i}`, requestCount: 10 })),
    ];

    const result = selectPathGroups(groups, DEFAULT_CANDIDATE_SELECTION_CONFIG);
    const wpLogin = result.selected.filter((g) => g.value.path === '/wp-login.php');
    expect(wpLogin).toHaveLength(1); // one group, not one per axis
    expect(wpLogin[0]?.selectionReasons).toEqual(
      expect.arrayContaining(['known_information', 'request_count', 'method_post']),
    );
  });

  it('never produces a weighted score — only a list of reasons', () => {
    const groups: PathAggregation[] = [path({ path: '/x', requestCount: 10 })];
    const result = selectPathGroups(groups, DEFAULT_CANDIDATE_SELECTION_CONFIG);
    for (const group of result.selected) {
      expect(group).not.toHaveProperty('score');
      expect(group).not.toHaveProperty('weight');
      expect(group).not.toHaveProperty('priority');
      expect(Array.isArray(group.selectionReasons)).toBe(true);
    }
  });

  it('produces a deterministic order across repeated runs on identical input', () => {
    const groups: PathAggregation[] = Array.from({ length: 50 }, (_, i) =>
      path({ path: `/p${i}`, requestCount: (i * 37) % 97 }),
    );
    const first = selectPathGroups([...groups], DEFAULT_CANDIDATE_SELECTION_CONFIG);
    const second = selectPathGroups([...groups], DEFAULT_CANDIDATE_SELECTION_CONFIG);
    expect(first.selected.map((g) => g.value.path)).toEqual(second.selected.map((g) => g.value.path));
  });

  it('fills representative slots from groups untouched by any axis', () => {
    const groups: PathAggregation[] = [
      path({ path: '/busy', requestCount: 1000 }),
      path({ path: '/quiet-a', requestCount: 1 }),
      path({ path: '/quiet-b', requestCount: 1 }),
    ];
    // distinctSourceIpLimit is zeroed out too: the path() factory defaults
    // distinctSourceIpCount to 1 for every group, which would otherwise let
    // that axis silently select /quiet-a and /quiet-b as well.
    const config = {
      ...DEFAULT_CANDIDATE_SELECTION_CONFIG,
      requestCountLimit: 1,
      distinctSourceIpLimit: 0,
      representativeLimit: 1,
    };
    const result = selectPathGroups(groups, config);
    const reasonsByPath = new Map(result.selected.map((g) => [g.value.path, g.selectionReasons]));
    expect(reasonsByPath.get('/busy')).toContain('request_count');
    const representativeCount = [...reasonsByPath.values()].filter((r) => r.includes('representative')).length;
    expect(representativeCount).toBe(1);
  });
});
