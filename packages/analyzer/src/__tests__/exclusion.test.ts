import { describe, expect, it } from 'vitest';
import { checkExclusion } from '../exclusion/apply-exclusion.js';
import { ExclusionSummaryBuilder } from '../exclusion/exclusion-summary-builder.js';
import type { ExclusionConfig, ExclusionRule } from '../exclusion/types.js';
import type { NormalizedAccessLogEntry } from '../types/normalized-entry.js';

function entry(overrides: Partial<NormalizedAccessLogEntry>): NormalizedAccessLogEntry {
  return { path: '/index.html', sourceIp: '192.0.2.1', ...overrides };
}

describe('checkExclusion', () => {
  it('excludes on path exact match', () => {
    const config: ExclusionConfig = {
      rules: [{ id: 'r1', target: 'path', matchType: 'exact', value: '/admin/secret' }],
    };
    expect(checkExclusion(entry({ path: '/admin/secret' }), config)).toEqual({ excluded: true, ruleId: 'r1' });
    expect(checkExclusion(entry({ path: '/other' }), config)).toEqual({ excluded: false });
  });

  it('excludes on path prefix match', () => {
    const config: ExclusionConfig = {
      rules: [{ id: 'r1', target: 'path', matchType: 'prefix', value: '/internal/' }],
    };
    expect(checkExclusion(entry({ path: '/internal/health-check' }), config)).toEqual({
      excluded: true,
      ruleId: 'r1',
    });
  });

  it('excludes on source IP exact match', () => {
    const config: ExclusionConfig = {
      rules: [{ id: 'r1', target: 'source_ip', matchType: 'exact', value: '198.51.100.99' }],
    };
    expect(checkExclusion(entry({ sourceIp: '198.51.100.99' }), config)).toEqual({
      excluded: true,
      ruleId: 'r1',
    });
    expect(checkExclusion(entry({ sourceIp: '198.51.100.1' }), config)).toEqual({ excluded: false });
  });

  it('is an identity stage when there are no rules', () => {
    expect(checkExclusion(entry({}), { rules: [] })).toEqual({ excluded: false });
  });
});

describe('ExclusionRule type constraint (F-02)', () => {
  it('rejects a source_ip rule with prefix matchType at compile time', () => {
    // @ts-expect-error source_ip exclusion is exact-only — no CIDR/prefix support in Sprint 2
    const invalidRule: ExclusionRule = {
      id: 'invalid',
      target: 'source_ip',
      matchType: 'prefix',
      value: '192.0.',
    };
    expect(invalidRule.matchType).toBe('prefix');
  });
});

describe('ExclusionSummaryBuilder', () => {
  it('accumulates counts per rule', () => {
    const builder = new ExclusionSummaryBuilder();
    expect(builder.build()).toEqual({ excludedEntryCount: 0 });

    builder.add('r1');
    builder.add('r1');
    builder.add('r2');

    expect(builder.build()).toEqual({
      excludedEntryCount: 3,
      byReason: [
        { ruleId: 'r1', count: 2 },
        { ruleId: 'r2', count: 1 },
      ],
    });
  });
});
