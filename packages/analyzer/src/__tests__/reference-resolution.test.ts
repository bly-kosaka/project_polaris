import { describe, expect, it } from 'vitest';
import type { SourceIpPathAggregation } from '../aggregation/types.js';
import { resolveReferences } from '../references/resolve-references.js';
import type { SelectedGroup } from '../selection/types.js';

function sourceIpPathGroup(sourceIp: string, path: string): SelectedGroup<SourceIpPathAggregation> {
  return {
    value: {
      sourceIp,
      path,
      requestCount: 1,
      queryVariantCount: 0,
      methodDistribution: [],
      statusDistribution: [],
      distinctUserAgentCount: 1,
      firstSeen: null,
      lastSeen: null,
      timeDistribution: [],
      knownInformation: [],
    },
    selectionReasons: ['request_count'],
  };
}

describe('resolveReferences', () => {
  it('attaches refs when both the path and source IP groups survived selection', () => {
    const groups = [sourceIpPathGroup('192.0.2.10', '/wp-login.php')];
    const { resolved, summary } = resolveReferences(
      groups,
      new Map([['/wp-login.php', 'path:abc123']]),
      new Map([['192.0.2.10', 'source-ip:def456']]),
    );

    expect(resolved[0]?.value.pathGroupRef).toEqual({ groupId: 'path:abc123', groupType: 'path' });
    expect(resolved[0]?.value.sourceIpGroupRef).toEqual({ groupId: 'source-ip:def456', groupType: 'source_ip' });
    expect(summary).toEqual({
      resolvedPathRefs: 1,
      resolvedSourceIpRefs: 1,
      unresolvedPathRefs: 0,
      unresolvedSourceIpRefs: 0,
    });
  });

  it('does not attach a ref when the target group was omitted by selection — and does not resurrect it', () => {
    const groups = [sourceIpPathGroup('192.0.2.10', '/never-selected-path')];
    const { resolved, summary } = resolveReferences(groups, new Map(), new Map([['192.0.2.10', 'source-ip:def456']]));

    expect(resolved[0]?.value.pathGroupRef).toBeUndefined();
    expect(resolved[0]?.value.sourceIpGroupRef).toEqual({ groupId: 'source-ip:def456', groupType: 'source_ip' });
    expect(summary.unresolvedPathRefs).toBe(1);
    expect(summary.resolvedSourceIpRefs).toBe(1);
  });
});
