import { describe, expect, it } from 'vitest';
import { analyzeAccessLog } from '../analyze.js';
import { ObservationSetValidationError } from '../errors.js';
import type { ObservationSet } from '../observation-set/types.js';
import { validateObservationSet } from '../observation-set/validate-observation-set.js';
import { linesFrom, SAMPLE_LOG_LINES } from './test-helpers.js';

async function validObservationSet(): Promise<ObservationSet> {
  const result = await analyzeAccessLog(linesFrom(SAMPLE_LOG_LINES));
  if (result.analyzerStatus === 'failed') throw new Error('expected a successful analysis');
  return result.observationSet;
}

describe('validateObservationSet', () => {
  it('accepts a well-formed ObservationSet without throwing', async () => {
    const observationSet = await validObservationSet();
    expect(() => validateObservationSet(observationSet)).not.toThrow();
  });

  it('rejects a missing schemaVersion', async () => {
    const observationSet = await validObservationSet();
    const broken = { ...observationSet, schemaVersion: '' };
    expect(() => validateObservationSet(broken)).toThrow(ObservationSetValidationError);
  });

  it('rejects duplicate group ids', async () => {
    const observationSet = await validObservationSet();
    if (observationSet.aggregations.paths.length === 0) throw new Error('fixture needs at least one path group');
    const duplicateId = observationSet.aggregations.paths[0]!.groupId;
    const broken: ObservationSet = {
      ...observationSet,
      aggregations: {
        ...observationSet.aggregations,
        sourceIps: observationSet.aggregations.sourceIps.map((g) => ({ ...g, groupId: duplicateId })),
      },
    };
    expect(() => validateObservationSet(broken)).toThrow(/Duplicate groupId/);
  });

  it('rejects a dangling reference to a group that was never selected', async () => {
    const observationSet = await validObservationSet();
    const broken: ObservationSet = {
      ...observationSet,
      aggregations: {
        ...observationSet.aggregations,
        sourceIpPaths: observationSet.aggregations.sourceIpPaths.map((g) => ({
          ...g,
          value: { ...g.value, pathGroupRef: { groupId: 'path:does-not-exist', groupType: 'path' as const } },
        })),
      },
    };
    if (broken.aggregations.sourceIpPaths.length === 0) return; // nothing to break in this fixture, skip
    expect(() => validateObservationSet(broken)).toThrow(/Dangling pathGroupRef/);
  });

  it('rejects inconsistent truncation arithmetic', async () => {
    const observationSet = await validObservationSet();
    const broken: ObservationSet = {
      ...observationSet,
      truncation: {
        ...observationSet.truncation,
        views: { ...observationSet.truncation.views, paths: { totalGroups: 10, selectedGroups: 3, omittedGroups: 3 } },
      },
    };
    expect(() => validateObservationSet(broken)).toThrow(/Truncation arithmetic mismatch/);
  });

  it('rejects an invalid selectionReason value', async () => {
    const observationSet = await validObservationSet();
    if (observationSet.aggregations.paths.length === 0) throw new Error('fixture needs at least one path group');
    const broken: ObservationSet = {
      ...observationSet,
      aggregations: {
        ...observationSet.aggregations,
        paths: [
          // @ts-expect-error deliberately invalid reason to test runtime validation
          { ...observationSet.aggregations.paths[0]!, selectionReasons: ['made_up_reason'] },
          ...observationSet.aggregations.paths.slice(1),
        ],
      },
    };
    expect(() => validateObservationSet(broken)).toThrow(/Invalid selectionReason/);
  });

  it('rejects a forbidden semantic field anywhere in the tree', async () => {
    const observationSet = await validObservationSet();
    const broken = { ...observationSet, overview: { ...observationSet.overview, severity: 'high' } };
    expect(() => validateObservationSet(broken as unknown as ObservationSet)).toThrow(/Forbidden semantic field/);
  });
});
