import type { Analysis, AnalysisStatus } from '@polaris/domain';
import type { PrismaClientLike } from '../client.js';
import { toPrismaAiStatus, toPrismaAnalysisStatus, toPrismaAnalyzerStatus } from '../enum-mappers.js';
import { DbError, mapPrismaError } from '../errors.js';
import { toDomainObservationSetRecord } from '../observation-set/mapper.js';
import { assertValidAnalysisStatusTransition } from '../status-transition.js';
import { toDomainUploadedAccessLog } from '../uploaded-access-log/mapper.js';
import type { AnalysisRepository } from './analysis-repository.js';
import { toDomainAnalysis } from './mapper.js';
import type { AnalysisListItem, CreateAnalysisPersistenceInput, UpdateAnalysisPersistenceFields } from './types.js';

function buildUpdateData(status: AnalysisStatus, fields?: UpdateAnalysisPersistenceFields) {
  const metadata = fields?.metadata;
  return {
    status: toPrismaAnalysisStatus(status),
    ...(fields?.analyzerStatus !== undefined ? { analyzerStatus: toPrismaAnalyzerStatus(fields.analyzerStatus) } : {}),
    ...(fields?.aiStatus !== undefined ? { aiStatus: toPrismaAiStatus(fields.aiStatus) } : {}),
    ...(metadata?.originalFileName !== undefined ? { originalFileName: metadata.originalFileName } : {}),
    ...(metadata?.fileSizeBytes !== undefined ? { fileSizeBytes: metadata.fileSizeBytes } : {}),
    ...(metadata?.detectedLogFormat !== undefined ? { detectedLogFormat: metadata.detectedLogFormat } : {}),
    ...(metadata?.firstSeen !== undefined ? { firstSeen: new Date(metadata.firstSeen) } : {}),
    ...(metadata?.lastSeen !== undefined ? { lastSeen: new Date(metadata.lastSeen) } : {}),
    ...(metadata?.totalLineCount !== undefined ? { totalLineCount: metadata.totalLineCount } : {}),
    ...(metadata?.totalRequestCount !== undefined ? { totalRequestCount: metadata.totalRequestCount } : {}),
    ...(metadata?.observationSetVersion !== undefined ? { observationSetVersion: metadata.observationSetVersion } : {}),
    ...(metadata?.analyzerConfigurationVersion !== undefined
      ? { analyzerConfigurationVersion: metadata.analyzerConfigurationVersion }
      : {}),
    ...(metadata?.knownInformationDatasetVersion !== undefined
      ? { knownInformationDatasetVersion: metadata.knownInformationDatasetVersion }
      : {}),
  };
}

export class PrismaAnalysisRepository implements AnalysisRepository {
  constructor(private readonly client: PrismaClientLike) {}

  async create(input: CreateAnalysisPersistenceInput): Promise<Analysis> {
    try {
      const record = await this.client.analysis.create({
        data: { projectId: input.projectId },
      });
      return toDomainAnalysis(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async findById(id: string): Promise<Analysis | null> {
    try {
      const record = await this.client.analysis.findUnique({ where: { id } });
      return record !== null ? toDomainAnalysis(record) : null;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async listByProjectId(projectId: string): Promise<Analysis[]> {
    try {
      const records = await this.client.analysis.findMany({ where: { projectId } });
      return records.map(toDomainAnalysis);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async listSummariesByProjectId(projectId: string): Promise<AnalysisListItem[]> {
    try {
      const records = await this.client.analysis.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        include: { uploadedAccessLog: true, observationSet: true },
      });
      return records.map((record) => {
        const uploadedAccessLog =
          record.uploadedAccessLog !== null ? toDomainUploadedAccessLog(record.uploadedAccessLog) : null;

        // A row whose stored ObservationSet fails validation (old schema,
        // corrupted data) degrades only its own requestCount to `undefined`
        // rather than failing the whole list (40_Sprint_5_Plan_Review.md F-01).
        let requestCount: number | undefined;
        if (record.observationSet !== null) {
          try {
            requestCount = toDomainObservationSetRecord(record.observationSet).data.overview.totalRequests;
          } catch {
            requestCount = undefined;
          }
        }

        return {
          ...toDomainAnalysis(record),
          ...(uploadedAccessLog !== null
            ? { originalFileName: uploadedAccessLog.originalFileName, fileSizeBytes: uploadedAccessLog.sizeBytes }
            : {}),
          ...(requestCount !== undefined ? { requestCount } : {}),
        };
      });
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async updateStatus(
    id: string,
    status: AnalysisStatus,
    fields?: UpdateAnalysisPersistenceFields,
  ): Promise<Analysis> {
    const current = await this.findById(id);
    if (current === null) {
      throw new DbError('NOT_FOUND', `Analysis ${id} was not found`);
    }
    assertValidAnalysisStatusTransition(current.status, status);

    try {
      const record = await this.client.analysis.update({
        where: { id },
        data: buildUpdateData(status, fields),
      });
      return toDomainAnalysis(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async compareAndSetStatus(
    id: string,
    from: AnalysisStatus,
    to: AnalysisStatus,
    fields?: UpdateAnalysisPersistenceFields,
  ): Promise<boolean> {
    assertValidAnalysisStatusTransition(from, to);
    try {
      const result = await this.client.analysis.updateMany({
        where: { id, status: toPrismaAnalysisStatus(from) },
        data: buildUpdateData(to, fields),
      });
      return result.count === 1;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
}
