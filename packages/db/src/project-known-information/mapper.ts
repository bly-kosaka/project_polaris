import { fromPrismaKnownInformationMatchType } from '../enum-mappers.js';
import type { ProjectKnownInformation as PrismaProjectKnownInformation } from '../generated/prisma/client.js';
import type { ProjectKnownInformation } from './types.js';

export function toDomainProjectKnownInformation(record: PrismaProjectKnownInformation): ProjectKnownInformation {
  return {
    id: record.id,
    projectId: record.projectId,
    target: 'path',
    matchType: fromPrismaKnownInformationMatchType(record.matchType),
    pattern: record.pattern,
    title: record.title,
    ...(record.description !== null ? { description: record.description } : {}),
    enabled: record.enabled,
  };
}
