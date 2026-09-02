import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../client.js';
import { PrismaAnalysisRepository } from '../analysis/prisma-analysis-repository.js';
import { PrismaAnalysisExecutionRepository } from '../analysis-execution/prisma-analysis-execution-repository.js';
import { PrismaProjectRepository } from '../project/prisma-project-repository.js';
import { resetDatabase } from './db-test-helpers.js';

describe('PrismaAnalysisExecutionRepository', () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  async function createAnalysis() {
    const project = await new PrismaProjectRepository(prisma).create({ name: 'Execution Test Project' });
    return new PrismaAnalysisRepository(prisma).create({ projectId: project.id });
  }

  it('creates and finds an execution by (analysisId, type)', async () => {
    const analysis = await createAnalysis();
    const repository = new PrismaAnalysisExecutionRepository(prisma);

    const created = await repository.create({ analysisId: analysis.id, type: 'analyzer' });
    expect(created.type).toBe('analyzer');
    expect(created.status).toBe('queued');
    expect(created.attempt).toBe(0);

    const found = await repository.findByAnalysisIdAndType(analysis.id, 'analyzer');
    expect(found).toEqual(created);
  });

  it('updateProgress updates status/attempt/errorCode/timestamps in place — one row per (analysisId, type)', async () => {
    const analysis = await createAnalysis();
    const repository = new PrismaAnalysisExecutionRepository(prisma);
    await repository.create({ analysisId: analysis.id, type: 'analyzer' });

    const running = await repository.updateProgress(analysis.id, 'analyzer', {
      status: 'running',
      attempt: 1,
      startedAt: new Date().toISOString(),
    });
    expect(running.status).toBe('running');
    expect(running.attempt).toBe(1);
    expect(running.startedAt).toBeDefined();

    const failed = await repository.updateProgress(analysis.id, 'analyzer', {
      status: 'failed',
      errorCode: 'PARSER_NO_VALID_LINES',
      completedAt: new Date().toISOString(),
    });
    expect(failed.status).toBe('failed');
    expect(failed.errorCode).toBe('PARSER_NO_VALID_LINES');
    // Same row throughout — attempt from the previous update is preserved.
    expect(failed.attempt).toBe(1);
  });

  it('rejects a second execution for the same (analysisId, type) — DB unique constraint (F-05)', async () => {
    const analysis = await createAnalysis();
    const repository = new PrismaAnalysisExecutionRepository(prisma);
    await repository.create({ analysisId: analysis.id, type: 'analyzer' });

    await expect(repository.create({ analysisId: analysis.id, type: 'analyzer' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('allows one analyzer execution and one ai_explanation execution for the same Analysis', async () => {
    const analysis = await createAnalysis();
    const repository = new PrismaAnalysisExecutionRepository(prisma);

    await repository.create({ analysisId: analysis.id, type: 'analyzer' });
    await expect(repository.create({ analysisId: analysis.id, type: 'ai_explanation' })).resolves.toMatchObject({
      type: 'ai_explanation',
    });
  });
});
