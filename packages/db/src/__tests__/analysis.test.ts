import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../client.js';
import { PrismaAnalysisRepository } from '../analysis/prisma-analysis-repository.js';
import { PrismaProjectRepository } from '../project/prisma-project-repository.js';
import { DbError } from '../errors.js';
import { resetDatabase } from './db-test-helpers.js';

describe('PrismaAnalysisRepository', () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  async function createProject() {
    return new PrismaProjectRepository(prisma).create({ name: 'Analysis Test Project' });
  }

  it('creates an analysis and finds it by id', async () => {
    const project = await createProject();
    const repository = new PrismaAnalysisRepository(prisma);

    const created = await repository.create({ projectId: project.id });

    expect(created.projectId).toBe(project.id);
    expect(created.status).toBe('created');
    expect(created.aiStatus).toBe('not_requested');
    expect(created.analyzerStatus).toBeUndefined();

    const found = await repository.findById(created.id);
    expect(found).toEqual(created);
  });

  it('lists all analyses for a project', async () => {
    const project = await createProject();
    const repository = new PrismaAnalysisRepository(prisma);

    const first = await repository.create({ projectId: project.id });
    const second = await repository.create({ projectId: project.id });

    const listed = await repository.listByProjectId(project.id);
    expect(listed.map((a) => a.id).sort()).toEqual([first.id, second.id].sort());
  });

  it('updates status along an allowed transition and persists metadata/analyzerStatus', async () => {
    const project = await createProject();
    const repository = new PrismaAnalysisRepository(prisma);
    const created = await repository.create({ projectId: project.id });

    const uploaded = await repository.updateStatus(created.id, 'uploaded', {
      metadata: { originalFileName: 'access.log', fileSizeBytes: 1024 },
    });
    expect(uploaded.status).toBe('uploaded');
    expect(uploaded.metadata.originalFileName).toBe('access.log');
    expect(uploaded.metadata.fileSizeBytes).toBe(1024);

    const analyzing = await repository.updateStatus(uploaded.id, 'analyzing');
    expect(analyzing.status).toBe('analyzing');

    const ready = await repository.updateStatus(analyzing.id, 'analyzer_result_ready', {
      analyzerStatus: 'success',
    });
    expect(ready.status).toBe('analyzer_result_ready');
    expect(ready.analyzerStatus).toBe('success');
  });

  it('rejects an invalid transition (created -> analyzer_result_ready directly)', async () => {
    const project = await createProject();
    const repository = new PrismaAnalysisRepository(prisma);
    const created = await repository.create({ projectId: project.id });

    await expect(repository.updateStatus(created.id, 'analyzer_result_ready')).rejects.toThrow(DbError);
  });

  it('throws NOT_FOUND when updating status on an unknown analysis', async () => {
    const repository = new PrismaAnalysisRepository(prisma);
    await expect(repository.updateStatus('nonexistent-id', 'uploaded')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  describe('compareAndSetStatus (F-07)', () => {
    it('returns true and applies the update when the current status matches `from`', async () => {
      const project = await createProject();
      const repository = new PrismaAnalysisRepository(prisma);
      const created = await repository.create({ projectId: project.id });
      await repository.updateStatus(created.id, 'uploaded');

      const claimed = await repository.compareAndSetStatus(created.id, 'uploaded', 'analyzing');
      expect(claimed).toBe(true);

      const reloaded = await repository.findById(created.id);
      expect(reloaded?.status).toBe('analyzing');
    });

    it('returns false without applying anything when the current status does not match `from` (T-02/T-15)', async () => {
      const project = await createProject();
      const repository = new PrismaAnalysisRepository(prisma);
      const created = await repository.create({ projectId: project.id });
      await repository.updateStatus(created.id, 'uploaded');
      await repository.updateStatus(created.id, 'analyzing');

      // A second CAS attempt from 'uploaded' finds the row already moved on.
      const claimed = await repository.compareAndSetStatus(created.id, 'uploaded', 'analyzing');
      expect(claimed).toBe(false);

      const reloaded = await repository.findById(created.id);
      expect(reloaded?.status).toBe('analyzing');
    });

    it('only one of two concurrent CAS calls wins on the same row (T-02 concurrency)', async () => {
      const project = await createProject();
      const repository = new PrismaAnalysisRepository(prisma);
      const created = await repository.create({ projectId: project.id });
      await repository.updateStatus(created.id, 'uploaded');

      const [first, second] = await Promise.all([
        repository.compareAndSetStatus(created.id, 'uploaded', 'analyzing'),
        repository.compareAndSetStatus(created.id, 'uploaded', 'analyzing'),
      ]);

      expect([first, second].filter(Boolean)).toHaveLength(1);
    });
  });
});
