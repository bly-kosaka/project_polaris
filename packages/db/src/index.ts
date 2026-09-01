export { prisma, type PrismaClientLike } from './client.js';
export { DbError, mapPrismaError, type DbErrorCode } from './errors.js';
export { assertValidAnalysisStatusTransition } from './status-transition.js';
export { persistAnalyzerFailure, persistAnalyzerSuccess } from './persist-analyzer-result.js';
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
} from './enum-mappers.js';

export type { CreateProjectPersistenceInput, ProjectRepository } from './project/index.js';
export { toDomainProject, PrismaProjectRepository } from './project/index.js';

export type {
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
