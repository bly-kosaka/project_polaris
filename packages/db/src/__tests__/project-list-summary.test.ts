import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../client.js';
import { PrismaAnalysisRepository } from '../analysis/prisma-analysis-repository.js';
import { PrismaProjectRepository } from '../project/prisma-project-repository.js';
import { resetDatabase } from './db-test-helpers.js';

describe('PrismaProjectRepository.listAllWithSummary (Sprint 5)', () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it('returns analysisCount and latestAnalysisAt computed in one query, per project', async () => {
    const projectRepository = new PrismaProjectRepository(prisma);
    const analysisRepository = new PrismaAnalysisRepository(prisma);

    const withAnalyses = await projectRepository.create({ name: 'Has Analyses' });
    const first = await analysisRepository.create({ projectId: withAnalyses.id });
    await new Promise((resolve) => setTimeout(resolve, 10)); // ensure createdAt ordering is unambiguous
    const second = await analysisRepository.create({ projectId: withAnalyses.id });

    const empty = await projectRepository.create({ name: 'No Analyses' });

    const list = await projectRepository.listAllWithSummary();
    const listedWithAnalyses = list.find((p) => p.id === withAnalyses.id);
    const listedEmpty = list.find((p) => p.id === empty.id);

    expect(listedWithAnalyses?.analysisCount).toBe(2);
    expect(listedWithAnalyses?.latestAnalysisAt).toBe(second.createdAt);
    expect(listedWithAnalyses?.latestAnalysisAt).not.toBe(first.createdAt);

    expect(listedEmpty?.analysisCount).toBe(0);
    expect(listedEmpty?.latestAnalysisAt).toBeUndefined();
  });
});
