import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../client.js';
import { PrismaProjectRepository } from '../project/prisma-project-repository.js';
import { PrismaProjectKnownInformationRepository } from '../project-known-information/prisma-project-known-information-repository.js';
import { toKnownInformationDataset } from '../project-known-information/known-information-mapper.js';
import { resetDatabase } from './db-test-helpers.js';

describe('PrismaProjectKnownInformationRepository', () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  async function createProject() {
    return new PrismaProjectRepository(prisma).create({ name: 'Known Information Test Project' });
  }

  it('creates and reads back a known-information entry', async () => {
    const project = await createProject();
    const repository = new PrismaProjectKnownInformationRepository(prisma);

    const created = await repository.create({
      projectId: project.id,
      matchType: 'exact',
      pattern: '/internal/health',
      title: 'Health check endpoint',
    });

    expect(created.target).toBe('path');
    expect(created.enabled).toBe(true);

    const found = await repository.findById(created.id);
    expect(found).toEqual(created);
  });

  it('toKnownInformationDataset excludes disabled rows', async () => {
    const project = await createProject();
    const repository = new PrismaProjectKnownInformationRepository(prisma);

    await repository.create({
      projectId: project.id,
      matchType: 'exact',
      pattern: '/enabled',
      title: 'Enabled entry',
      enabled: true,
    });
    await repository.create({
      projectId: project.id,
      matchType: 'exact',
      pattern: '/disabled',
      title: 'Disabled entry',
      enabled: false,
    });

    const all = await repository.listByProjectId(project.id);
    expect(all).toHaveLength(2);

    const dataset = toKnownInformationDataset(all);
    expect(dataset).toHaveLength(1);
    expect(dataset[0]?.pattern).toBe('/enabled');
    expect(dataset[0]?.source).toBe('project');
  });
});
