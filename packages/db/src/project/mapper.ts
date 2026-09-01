import type { Project } from '@polaris/domain';
import { fromPrismaProjectStatus } from '../enum-mappers.js';
import type { Project as PrismaProject } from '../generated/prisma/client.js';

export function toDomainProject(record: PrismaProject): Project {
  const site =
    record.primaryUrl !== null || record.hostname !== null
      ? {
          ...(record.primaryUrl !== null ? { primaryUrl: record.primaryUrl } : {}),
          ...(record.hostname !== null ? { hostname: record.hostname } : {}),
        }
      : undefined;

  return {
    id: record.id,
    name: record.name,
    ...(record.description !== null ? { description: record.description } : {}),
    ...(site !== undefined ? { site } : {}),
    status: fromPrismaProjectStatus(record.status),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
