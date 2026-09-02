import type { UploadedAccessLog } from '@polaris/domain';
import { fromPrismaRawLogDeletionStatus, fromPrismaUploadedAccessLogStatus } from '../enum-mappers.js';
import type { UploadedAccessLog as PrismaUploadedAccessLog } from '../generated/prisma/client.js';

export function toDomainUploadedAccessLog(record: PrismaUploadedAccessLog): UploadedAccessLog {
  return {
    id: record.id,
    analysisId: record.analysisId,
    originalFileName: record.originalFileName,
    sizeBytes: record.sizeBytes,
    ...(record.mimeType !== null ? { mimeType: record.mimeType } : {}),
    storageKey: record.storageKey,
    status: fromPrismaUploadedAccessLogStatus(record.status),
    deletionStatus: fromPrismaRawLogDeletionStatus(record.deletionStatus),
    createdAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    ...(record.deletedAt !== null ? { deletedAt: record.deletedAt.toISOString() } : {}),
  };
}
