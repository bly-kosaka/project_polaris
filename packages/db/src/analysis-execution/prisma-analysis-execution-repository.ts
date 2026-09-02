import type { AnalysisExecution, AnalysisExecutionType } from '@polaris/domain';
import type { PrismaClientLike } from '../client.js';
import {
  toPrismaAnalysisExecutionStatus,
  toPrismaAnalysisExecutionType,
} from '../enum-mappers.js';
import { mapPrismaError } from '../errors.js';
import { AnalysisExecutionStatus } from '../generated/prisma/client.js';
import { toDomainAnalysisExecution } from './mapper.js';
import type { AnalysisExecutionRepository } from './analysis-execution-repository.js';
import type { CreateAnalysisExecutionInput, UpdateAnalysisExecutionProgressInput } from './types.js';

export class PrismaAnalysisExecutionRepository implements AnalysisExecutionRepository {
  constructor(private readonly client: PrismaClientLike) {}

  async create(input: CreateAnalysisExecutionInput): Promise<AnalysisExecution> {
    try {
      const record = await this.client.analysisExecution.create({
        data: {
          analysisId: input.analysisId,
          type: toPrismaAnalysisExecutionType(input.type),
          status: AnalysisExecutionStatus.QUEUED,
        },
      });
      return toDomainAnalysisExecution(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async findByAnalysisIdAndType(
    analysisId: string,
    type: AnalysisExecutionType,
  ): Promise<AnalysisExecution | null> {
    try {
      const record = await this.client.analysisExecution.findUnique({
        where: { analysisId_type: { analysisId, type: toPrismaAnalysisExecutionType(type) } },
      });
      return record !== null ? toDomainAnalysisExecution(record) : null;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async updateProgress(
    analysisId: string,
    type: AnalysisExecutionType,
    fields: UpdateAnalysisExecutionProgressInput,
  ): Promise<AnalysisExecution> {
    try {
      const record = await this.client.analysisExecution.update({
        where: { analysisId_type: { analysisId, type: toPrismaAnalysisExecutionType(type) } },
        data: {
          ...(fields.status !== undefined ? { status: toPrismaAnalysisExecutionStatus(fields.status) } : {}),
          ...(fields.attempt !== undefined ? { attempt: fields.attempt } : {}),
          ...(fields.errorCode !== undefined ? { errorCode: fields.errorCode } : {}),
          ...(fields.startedAt !== undefined ? { startedAt: new Date(fields.startedAt) } : {}),
          ...(fields.completedAt !== undefined ? { completedAt: new Date(fields.completedAt) } : {}),
        },
      });
      return toDomainAnalysisExecution(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
}
