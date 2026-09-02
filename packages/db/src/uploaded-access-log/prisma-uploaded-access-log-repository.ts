import type { UploadedAccessLog } from '@polaris/domain';
import type { PrismaClientLike } from '../client.js';
import { toPrismaUploadedAccessLogStatus, toPrismaRawLogDeletionStatus } from '../enum-mappers.js';
import { mapPrismaError } from '../errors.js';
import { UploadedAccessLogStatus, RawLogDeletionStatus } from '../generated/prisma/client.js';
import { toDomainUploadedAccessLog } from './mapper.js';
import type { UploadedAccessLogRepository } from './uploaded-access-log-repository.js';
import type { CreateUploadedAccessLogPersistenceInput, MarkDeletionSuccessReason } from './types.js';

export class PrismaUploadedAccessLogRepository implements UploadedAccessLogRepository {
  constructor(private readonly client: PrismaClientLike) {}

  async create(input: CreateUploadedAccessLogPersistenceInput): Promise<UploadedAccessLog> {
    try {
      const record = await this.client.uploadedAccessLog.create({
        data: {
          analysisId: input.analysisId,
          originalFileName: input.originalFileName,
          sizeBytes: input.sizeBytes,
          mimeType: input.mimeType ?? null,
          storageKey: input.storageKey,
          expiresAt: new Date(input.expiresAt),
          status: toPrismaUploadedAccessLogStatus('uploaded'),
          deletionStatus: toPrismaRawLogDeletionStatus('pending'),
        },
      });
      return toDomainUploadedAccessLog(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async findByAnalysisId(analysisId: string): Promise<UploadedAccessLog | null> {
    try {
      const record = await this.client.uploadedAccessLog.findUnique({ where: { analysisId } });
      return record !== null ? toDomainUploadedAccessLog(record) : null;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async markProcessing(analysisId: string): Promise<UploadedAccessLog> {
    try {
      const record = await this.client.uploadedAccessLog.update({
        where: { analysisId },
        data: { status: UploadedAccessLogStatus.PROCESSING },
      });
      return toDomainUploadedAccessLog(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async markDeletionSuccess(
    analysisId: string,
    params: { reason: MarkDeletionSuccessReason },
  ): Promise<UploadedAccessLog> {
    try {
      const record = await this.client.uploadedAccessLog.update({
        where: { analysisId },
        data: {
          status: params.reason === 'expired' ? UploadedAccessLogStatus.EXPIRED : UploadedAccessLogStatus.DELETED,
          deletionStatus: RawLogDeletionStatus.SUCCESS,
          deletedAt: new Date(),
        },
      });
      return toDomainUploadedAccessLog(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async markDeletionFailed(analysisId: string): Promise<UploadedAccessLog> {
    try {
      const record = await this.client.uploadedAccessLog.update({
        where: { analysisId },
        data: { deletionStatus: RawLogDeletionStatus.FAILED },
      });
      return toDomainUploadedAccessLog(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async findExpiredCandidates(now: Date): Promise<UploadedAccessLog[]> {
    try {
      const records = await this.client.uploadedAccessLog.findMany({
        where: {
          expiresAt: { lt: now },
          status: { notIn: [UploadedAccessLogStatus.DELETED, UploadedAccessLogStatus.EXPIRED] },
        },
      });
      return records.map(toDomainUploadedAccessLog);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
}
