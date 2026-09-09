export { prisma, type PrismaClientLike } from './client.js';
export { DbError, mapPrismaError, type DbErrorCode } from './errors.js';
export { assertValidAnalysisStatusTransition } from './status-transition.js';
export { persistAnalyzerFailure, persistAnalyzerSuccess } from './persist-analyzer-result.js';
export { persistAiExplanationFailure, persistAiExplanationSuccess } from './persist-ai-explanation-result.js';
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

export type { CreateAccountInput, AccountRepository } from './account/index.js';
export { toDomainAccount, PrismaAccountRepository } from './account/index.js';

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

export type {
  AIExplanationRecord,
  CreateAIExplanationRecordInput,
  AIExplanationRepository,
} from './ai-explanation/index.js';
export { toDomainAiExplanationRecord, PrismaAIExplanationRepository } from './ai-explanation/index.js';

export type { CreateBillingCustomerInput, BillingCustomerRepository } from './billing-customer/index.js';
export { toDomainBillingCustomer, PrismaBillingCustomerRepository } from './billing-customer/index.js';

export type { UpsertSubscriptionInput, SubscriptionRepository } from './subscription/index.js';
export { toDomainSubscription, PrismaSubscriptionRepository } from './subscription/index.js';

export type { CreateBillingWebhookEventInput, BillingWebhookEventRepository } from './billing-webhook-event/index.js';
export { PrismaBillingWebhookEventRepository } from './billing-webhook-event/index.js';

export type { CreateUsageEventInput, UsageEventRepository } from './usage-event/index.js';
export { toDomainUsageEvent, PrismaUsageEventRepository } from './usage-event/index.js';
