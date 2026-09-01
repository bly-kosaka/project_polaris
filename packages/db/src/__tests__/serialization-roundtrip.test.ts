import { validateObservationSet } from '@polaris/analyzer';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../client.js';
import { PrismaObservationSetRepository } from '../observation-set/prisma-observation-set-repository.js';
import { buildValidObservationSet, createAnalysisInAnalyzingState, resetDatabase } from './db-test-helpers.js';

describe('ObservationSet JSON round-trip', () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it('preserves schemaVersion and stays valid after a DB round-trip', async () => {
    const { analysisId } = await createAnalysisInAnalyzingState(prisma);
    const observationSet = await buildValidObservationSet();
    const repository = new PrismaObservationSetRepository(prisma);

    await repository.create({ analysisId, schemaVersion: observationSet.schemaVersion, data: observationSet });

    const read = await repository.findByAnalysisId(analysisId);
    expect(read).not.toBeNull();
    // biome-ignore-line: non-null asserted just above
    expect(() => validateObservationSet(read!.data)).not.toThrow();
    expect(read?.data.schemaVersion).toBe(observationSet.schemaVersion);
    expect(read?.data).toEqual(JSON.parse(JSON.stringify(observationSet)));
  });
});
