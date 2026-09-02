import type { AnalysisExecution } from '@polaris/domain';
import { fromPrismaAnalysisExecutionStatus, fromPrismaAnalysisExecutionType } from '../enum-mappers.js';
import type { AnalysisExecution as PrismaAnalysisExecution } from '../generated/prisma/client.js';

export function toDomainAnalysisExecution(record: PrismaAnalysisExecution): AnalysisExecution {
  return {
    id: record.id,
    analysisId: record.analysisId,
    type: fromPrismaAnalysisExecutionType(record.type),
    status: fromPrismaAnalysisExecutionStatus(record.status),
    attempt: record.attempt,
    ...(record.errorCode !== null ? { errorCode: record.errorCode } : {}),
    ...(record.startedAt !== null ? { startedAt: record.startedAt.toISOString() } : {}),
    ...(record.completedAt !== null ? { completedAt: record.completedAt.toISOString() } : {}),
    createdAt: record.createdAt.toISOString(),
  };
}
