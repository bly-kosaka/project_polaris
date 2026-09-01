import type { AIStatus, AnalysisStatus, AnalyzerStatus, ProjectStatus } from '@polaris/domain';
import type { KnownInformationMatchType as DomainKnownInformationMatchType } from '@polaris/analyzer';
import {
  AIExecutionStatus,
  AnalysisLifecycleStatus,
  AnalyzerExecutionStatus,
  KnownInformationMatchType,
  ProjectStatus as PrismaProjectStatus,
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
