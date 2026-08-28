import { describe, expect, it } from 'vitest';
import { buildTruncationSummary } from '../truncation/build-truncation-summary.js';
import type { ViewTruncation } from '../truncation/types.js';

function view(totalGroups: number, selectedGroups: number): ViewTruncation {
  return { totalGroups, selectedGroups, omittedGroups: totalGroups - selectedGroups };
}

const emptyViews = {
  paths: view(0, 0),
  sourceIps: view(0, 0),
  sourceIpPaths: view(0, 0),
  statuses: view(0, 0),
  methods: view(0, 0),
  userAgents: view(0, 0),
  time1m: view(0, 0),
  time5m: view(0, 0),
};

describe('buildTruncationSummary', () => {
  it('reports truncated=false when nothing was omitted anywhere', () => {
    const summary = buildTruncationSummary(emptyViews, []);
    expect(summary.truncated).toBe(false);
  });

  it('reports truncated=true when any single view has omissions', () => {
    const summary = buildTruncationSummary({ ...emptyViews, paths: view(100, 80) }, []);
    expect(summary.truncated).toBe(true);
    expect(summary.views.paths).toEqual({ totalGroups: 100, selectedGroups: 80, omittedGroups: 20 });
  });

  it('reports truncated=true when Known Information omissions exist even if every view total matches', () => {
    const summary = buildTruncationSummary(emptyViews, [{ knownInformationId: 'built_in.env.file', omittedGroupCount: 2 }]);
    expect(summary.truncated).toBe(true);
    expect(summary.knownInformationOmissions).toEqual([{ knownInformationId: 'built_in.env.file', omittedGroupCount: 2 }]);
  });

  it('keeps totalGroups = selectedGroups + omittedGroups for every view (no silent truncation)', () => {
    const summary = buildTruncationSummary(
      { ...emptyViews, paths: view(80, 80), sourceIps: view(60, 45), time1m: view(200, 120) },
      [],
    );
    for (const v of Object.values(summary.views)) {
      expect(v.selectedGroups + v.omittedGroups).toBe(v.totalGroups);
    }
  });
});
