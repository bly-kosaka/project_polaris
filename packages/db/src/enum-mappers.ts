import type {
  AIStatus,
  AnalysisExecutionStatus as DomainAnalysisExecutionStatus,
  AnalysisExecutionType as DomainAnalysisExecutionType,
  AnalysisStatus,
  AnalyzerStatus,
  ProjectStatus,
  RawLogDeletionStatus as DomainRawLogDeletionStatus,
  UploadedAccessLogStatus as DomainUploadedAccessLogStatus,
} from '@polaris/domain';
import type { KnownInformationMatchType as DomainKnownInformationMatchType } from '@polaris/analyzer';
import {
  AIExecutionStatus,
  AnalysisExecutionStatus,
  AnalysisExecutionType,
  AnalysisLifecycleStatus,
  AnalyzerExecutionStatus,
  KnownInformationMatchType,
  ProjectStatus as PrismaProjectStatus,
  RawLogDeletionStatus,
  UploadedAccessLogStatus,
} from './generated/prisma/client.js';

/**
 * Bidirectional translation between the lowercase-snake domain enums
 * (@polaris/domain, @polaris/analyzer) and the UPPER_SNAKE_CASE Prisma
 * enums generated from schema.prisma — kept in one place so the mapping
 * is never duplicated across the four entity folders.
 */

const ANALYSIS_STATUS_TO_PRISMA: Record<AnalysisStatus, AnalysisLifecycleStatus> = {
  created: AnalysisLifecycleStatus.CREATED,
  uploaded: AnalysisLifecycleStatus.UPLOADED,
  analyzing: AnalysisLifecycleStatus.ANALYZING,
  analyzer_result_ready: AnalysisLifecycleStatus.ANALYZER_RESULT_READY,
  explaining: AnalysisLifecycleStatus.EXPLAINING,
  completed: AnalysisLifecycleStatus.COMPLETED,
  failed: AnalysisLifecycleStatus.FAILED,
};

const PRISMA_TO_ANALYSIS_STATUS: Record<AnalysisLifecycleStatus, AnalysisStatus> = {
  CREATED: 'created',
  UPLOADED: 'uploaded',
  ANALYZING: 'analyzing',
  ANALYZER_RESULT_READY: 'analyzer_result_ready',
  EXPLAINING: 'explaining',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export function toPrismaAnalysisStatus(status: AnalysisStatus): AnalysisLifecycleStatus {
  return ANALYSIS_STATUS_TO_PRISMA[status];
}

export function fromPrismaAnalysisStatus(status: AnalysisLifecycleStatus): AnalysisStatus {
  return PRISMA_TO_ANALYSIS_STATUS[status];
}

const ANALYZER_STATUS_TO_PRISMA: Record<AnalyzerStatus, AnalyzerExecutionStatus> = {
  queued: AnalyzerExecutionStatus.QUEUED,
  running: AnalyzerExecutionStatus.RUNNING,
  success: AnalyzerExecutionStatus.SUCCESS,
  partial: AnalyzerExecutionStatus.PARTIAL,
  failed: AnalyzerExecutionStatus.FAILED,
};

const PRISMA_TO_ANALYZER_STATUS: Record<AnalyzerExecutionStatus, AnalyzerStatus> = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCESS: 'success',
  PARTIAL: 'partial',
  FAILED: 'failed',
};

export function toPrismaAnalyzerStatus(status: AnalyzerStatus): AnalyzerExecutionStatus {
  return ANALYZER_STATUS_TO_PRISMA[status];
}

export function fromPrismaAnalyzerStatus(status: AnalyzerExecutionStatus): AnalyzerStatus {
  return PRISMA_TO_ANALYZER_STATUS[status];
}

const AI_STATUS_TO_PRISMA: Record<AIStatus, AIExecutionStatus> = {
  not_requested: AIExecutionStatus.NOT_REQUESTED,
  queued: AIExecutionStatus.QUEUED,
  running: AIExecutionStatus.RUNNING,
  success: AIExecutionStatus.SUCCESS,
  failed: AIExecutionStatus.FAILED,
};

const PRISMA_TO_AI_STATUS: Record<AIExecutionStatus, AIStatus> = {
  NOT_REQUESTED: 'not_requested',
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
};

export function toPrismaAiStatus(status: AIStatus): AIExecutionStatus {
  return AI_STATUS_TO_PRISMA[status];
}

export function fromPrismaAiStatus(status: AIExecutionStatus): AIStatus {
  return PRISMA_TO_AI_STATUS[status];
}

const KNOWN_INFORMATION_MATCH_TYPE_TO_PRISMA: Record<DomainKnownInformationMatchType, KnownInformationMatchType> = {
  exact: KnownInformationMatchType.EXACT,
  prefix: KnownInformationMatchType.PREFIX,
};

const PRISMA_TO_KNOWN_INFORMATION_MATCH_TYPE: Record<KnownInformationMatchType, DomainKnownInformationMatchType> = {
  EXACT: 'exact',
  PREFIX: 'prefix',
};

export function toPrismaKnownInformationMatchType(
  matchType: DomainKnownInformationMatchType,
): KnownInformationMatchType {
  return KNOWN_INFORMATION_MATCH_TYPE_TO_PRISMA[matchType];
}

export function fromPrismaKnownInformationMatchType(
  matchType: KnownInformationMatchType,
): DomainKnownInformationMatchType {
  return PRISMA_TO_KNOWN_INFORMATION_MATCH_TYPE[matchType];
}

const PROJECT_STATUS_TO_PRISMA: Record<ProjectStatus, PrismaProjectStatus> = {
  active: PrismaProjectStatus.ACTIVE,
  archived: PrismaProjectStatus.ARCHIVED,
};

const PRISMA_TO_PROJECT_STATUS: Record<PrismaProjectStatus, ProjectStatus> = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
};

export function toPrismaProjectStatus(status: ProjectStatus): PrismaProjectStatus {
  return PROJECT_STATUS_TO_PRISMA[status];
}

export function fromPrismaProjectStatus(status: PrismaProjectStatus): ProjectStatus {
  return PRISMA_TO_PROJECT_STATUS[status];
}

const UPLOADED_ACCESS_LOG_STATUS_TO_PRISMA: Record<DomainUploadedAccessLogStatus, UploadedAccessLogStatus> = {
  uploaded: UploadedAccessLogStatus.UPLOADED,
  processing: UploadedAccessLogStatus.PROCESSING,
  deleted: UploadedAccessLogStatus.DELETED,
  expired: UploadedAccessLogStatus.EXPIRED,
};

const PRISMA_TO_UPLOADED_ACCESS_LOG_STATUS: Record<UploadedAccessLogStatus, DomainUploadedAccessLogStatus> = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  DELETED: 'deleted',
  EXPIRED: 'expired',
};

export function toPrismaUploadedAccessLogStatus(status: DomainUploadedAccessLogStatus): UploadedAccessLogStatus {
  return UPLOADED_ACCESS_LOG_STATUS_TO_PRISMA[status];
}

export function fromPrismaUploadedAccessLogStatus(status: UploadedAccessLogStatus): DomainUploadedAccessLogStatus {
  return PRISMA_TO_UPLOADED_ACCESS_LOG_STATUS[status];
}

const RAW_LOG_DELETION_STATUS_TO_PRISMA: Record<DomainRawLogDeletionStatus, RawLogDeletionStatus> = {
  pending: RawLogDeletionStatus.PENDING,
  success: RawLogDeletionStatus.SUCCESS,
  failed: RawLogDeletionStatus.FAILED,
};

const PRISMA_TO_RAW_LOG_DELETION_STATUS: Record<RawLogDeletionStatus, DomainRawLogDeletionStatus> = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
};

export function toPrismaRawLogDeletionStatus(status: DomainRawLogDeletionStatus): RawLogDeletionStatus {
  return RAW_LOG_DELETION_STATUS_TO_PRISMA[status];
}

export function fromPrismaRawLogDeletionStatus(status: RawLogDeletionStatus): DomainRawLogDeletionStatus {
  return PRISMA_TO_RAW_LOG_DELETION_STATUS[status];
}

const ANALYSIS_EXECUTION_TYPE_TO_PRISMA: Record<DomainAnalysisExecutionType, AnalysisExecutionType> = {
  analyzer: AnalysisExecutionType.ANALYZER,
  ai_explanation: AnalysisExecutionType.AI_EXPLANATION,
};

const PRISMA_TO_ANALYSIS_EXECUTION_TYPE: Record<AnalysisExecutionType, DomainAnalysisExecutionType> = {
  ANALYZER: 'analyzer',
  AI_EXPLANATION: 'ai_explanation',
};

export function toPrismaAnalysisExecutionType(type: DomainAnalysisExecutionType): AnalysisExecutionType {
  return ANALYSIS_EXECUTION_TYPE_TO_PRISMA[type];
}

export function fromPrismaAnalysisExecutionType(type: AnalysisExecutionType): DomainAnalysisExecutionType {
  return PRISMA_TO_ANALYSIS_EXECUTION_TYPE[type];
}

const ANALYSIS_EXECUTION_STATUS_TO_PRISMA: Record<DomainAnalysisExecutionStatus, AnalysisExecutionStatus> = {
  queued: AnalysisExecutionStatus.QUEUED,
  running: AnalysisExecutionStatus.RUNNING,
  success: AnalysisExecutionStatus.SUCCESS,
  partial: AnalysisExecutionStatus.PARTIAL,
  failed: AnalysisExecutionStatus.FAILED,
};

const PRISMA_TO_ANALYSIS_EXECUTION_STATUS: Record<AnalysisExecutionStatus, DomainAnalysisExecutionStatus> = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCESS: 'success',
  PARTIAL: 'partial',
  FAILED: 'failed',
};

export function toPrismaAnalysisExecutionStatus(status: DomainAnalysisExecutionStatus): AnalysisExecutionStatus {
  return ANALYSIS_EXECUTION_STATUS_TO_PRISMA[status];
}

export function fromPrismaAnalysisExecutionStatus(status: AnalysisExecutionStatus): DomainAnalysisExecutionStatus {
  return PRISMA_TO_ANALYSIS_EXECUTION_STATUS[status];
}
