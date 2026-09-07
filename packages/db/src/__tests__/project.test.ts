import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../client.js';
import { PrismaProjectRepository } from '../project/prisma-project-repository.js';
import { createTestAccount, resetDatabase } from './db-test-helpers.js';

describe('PrismaProjectRepository', () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it('creates a project and finds it by id', async () => {
    const repository = new PrismaProjectRepository(prisma);
    const account = await createTestAccount(prisma);

    const created = await repository.create({
      name: 'Test Project',
      description: 'A project used for repository tests',
      primaryUrl: 'https://example.com',
      hostname: 'example.com',
      ownerAccountId: account.id,
    });

    expect(created.name).toBe('Test Project');
    expect(created.status).toBe('active');
    expect(created.site).toEqual({ primaryUrl: 'https://example.com', hostname: 'example.com' });
    expect(created.ownerAccountId).toBe(account.id);

    const found = await repository.findById(created.id);
    expect(found).toEqual(created);
  });

  it('returns null for an unknown id', async () => {
    const repository = new PrismaProjectRepository(prisma);
    const found = await repository.findById('nonexistent-id');
    expect(found).toBeNull();
  });

  it('omits site when neither primaryUrl nor hostname is set', async () => {
    const repository = new PrismaProjectRepository(prisma);
    const account = await createTestAccount(prisma);
    const created = await repository.create({ name: 'Minimal Project', ownerAccountId: account.id });
    expect(created.site).toBeUndefined();
  });
});
