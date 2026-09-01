import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../client.js';
import { PrismaObservationSetRepository } from '../observation-set/prisma-observation-set-repository.js';
import { buildValidObservationSet, createAnalysisInAnalyzingState, resetDatabase } from './db-test-helpers.js';

describe('ObservationSetRecord uniqueness', () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it('rejects a second ObservationSetRecord for the same analysisId with CONFLICT', async () => {
    const { analysisId } = await createAnalysisInAnalyzingState(prisma);
    const observationSet = await buildValidObservationSet();
    const repository = new PrismaObservationSetRepository(prisma);

    await repository.create({ analysisId, schemaVersion: observationSet.schemaVersion, data: observationSet });

    await expect(
      repository.create({ analysisId, schemaVersion: observationSet.schemaVersion, data: observationSet }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
