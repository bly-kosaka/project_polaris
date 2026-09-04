export { prisma, type PrismaClientLike } from './client.js';
export { DbError, mapPrismaError, type DbErrorCode } from './errors.js';
export { assertValidAnalysisStatusTransition } from './status-transition.js';
export { persistAnalyzerFailure, persistAnalyzerSuccess } from './persist-analyzer-result.js';
export { persistUploadedAccessLog } from './persist-upload.js';
export {
  toPrismaAnalysisStatus,
  fromPrismaAnalysisStatus,
  toPrismaAnalyzerStatus,
  fromPrismaAnalyzerStatus,
  toPrismaAiStatus,
  fromPrismaAiStatus,
  toPrismaKnownInformationMatchType,
  fromPrismaKnownInformationMatchType,
  toPrismaProjectStatus,
  fromPrismaProjectStatus,
  toPrismaUploadedAccessLogStatus,
  fromPrismaUploadedAccessLogStatus,
  toPrismaRawLogDeletionStatus,
  fromPrismaRawLogDeletionStatus,
  toPrismaAnalysisExecutionType,
  fromPrismaAnalysisExecutionType,
  toPrismaAnalysisExecutionStatus,
  fromPrismaAnalysisExecutionStatus,
} from './enum-mappers.js';

export type { CreateProjectPersistenceInput, ProjectListItem, ProjectRepository } from './project/index.js';
export { toDomainProject, PrismaProjectRepository } from './project/index.js';

export type {
  AnalysisListItem,
  CreateAnalysisPersistenceInput,
  UpdateAnalysisPersistenceFields,
  AnalysisRepository,
} from './analysis/index.js';
export { toDomainAnalysis, PrismaAnalysisRepository } from './analysis/index.js';

export type {
  CreateObservationSetRecordInput,
  ObservationSetRecord,
  ObservationSetRepository,
} from './observation-set/index.js';
export { toDomainObservationSetRecord, PrismaObservationSetRepository } from './observation-set/index.js';

export type {
  CreateProjectKnownInformationInput,
  ProjectKnownInformation,
  ProjectKnownInformationRepository,
} from './project-known-information/index.js';
export {
  toDomainProjectKnownInformation,
  toKnownInformationDataset,
  toKnownInformationEntry,
  PrismaProjectKnownInformationRepository,
} from './project-known-information/index.js';

export type {
  CreateUploadedAccessLogPersistenceInput,
  MarkDeletionSuccessReason,
  UploadedAccessLogRepository,
} from './uploaded-access-log/index.js';
export { toDomainUploadedAccessLog, PrismaUploadedAccessLogRepository } from './uploaded-access-log/index.js';

export type {
  CreateAnalysisExecutionInput,
  UpdateAnalysisExecutionProgressInput,
  AnalysisExecutionRepository,
} from './analysis-execution/index.js';
export { toDomainAnalysisExecution, PrismaAnalysisExecutionRepository } from './analysis-execution/index.js';
