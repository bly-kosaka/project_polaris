import type { Analysis, AnalysisMetadata } from '@polaris/domain';
import { fromPrismaAiStatus, fromPrismaAnalysisStatus, fromPrismaAnalyzerStatus } from '../enum-mappers.js';
import type { Analysis as PrismaAnalysis } from '../generated/prisma/client.js';

export function toDomainAnalysis(record: PrismaAnalysis): Analysis {
  const metadata: AnalysisMetadata = {
    ...(record.originalFileName !== null ? { originalFileName: record.originalFileName } : {}),
    ...(record.fileSizeBytes !== null ? { fileSizeBytes: record.fileSizeBytes } : {}),
    ...(record.detectedLogFormat !== null ? { detectedLogFormat: record.detectedLogFormat } : {}),
    ...(record.firstSeen !== null ? { firstSeen: record.firstSeen.toISOString() } : {}),
    ...(record.lastSeen !== null ? { lastSeen: record.lastSeen.toISOString() } : {}),
    ...(record.totalLineCount !== null ? { totalLineCount: record.totalLineCount } : {}),
    ...(record.totalRequestCount !== null ? { totalRequestCount: record.totalRequestCount } : {}),
    ...(record.observationSetVersion !== null ? { observationSetVersion: record.observationSetVersion } : {}),
    ...(record.analyzerConfigurationVersion !== null
      ? { analyzerConfigurationVersion: record.analyzerConfigurationVersion }
      : {}),
    ...(record.knownInformationDatasetVersion !== null
      ? { knownInformationDatasetVersion: record.knownInformationDatasetVersion }
      : {}),
  };

  return {
    id: record.id,
    projectId: record.projectId,
    status: fromPrismaAnalysisStatus(record.status),
    ...(record.analyzerStatus !== null ? { analyzerStatus: fromPrismaAnalyzerStatus(record.analyzerStatus) } : {}),
    aiStatus: fromPrismaAiStatus(record.aiStatus),
    metadata,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
