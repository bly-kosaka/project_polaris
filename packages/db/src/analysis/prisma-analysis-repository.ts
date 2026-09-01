import type { Analysis, AnalysisStatus } from '@polaris/domain';
import type { PrismaClientLike } from '../client.js';
import { toPrismaAnalysisStatus, toPrismaAnalyzerStatus } from '../enum-mappers.js';
import { DbError, mapPrismaError } from '../errors.js';
import { assertValidAnalysisStatusTransition } from '../status-transition.js';
import type { AnalysisRepository } from './analysis-repository.js';
import { toDomainAnalysis } from './mapper.js';
import type { CreateAnalysisPersistenceInput, UpdateAnalysisPersistenceFields } from './types.js';

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

    const metadata = fields?.metadata;
    try {
      const record = await this.client.analysis.update({
        where: { id },
        data: {
          status: toPrismaAnalysisStatus(status),
          ...(fields?.analyzerStatus !== undefined
            ? { analyzerStatus: toPrismaAnalyzerStatus(fields.analyzerStatus) }
            : {}),
          ...(metadata?.originalFileName !== undefined ? { originalFileName: metadata.originalFileName } : {}),
          ...(metadata?.fileSizeBytes !== undefined ? { fileSizeBytes: metadata.fileSizeBytes } : {}),
          ...(metadata?.detectedLogFormat !== undefined ? { detectedLogFormat: metadata.detectedLogFormat } : {}),
          ...(metadata?.firstSeen !== undefined ? { firstSeen: new Date(metadata.firstSeen) } : {}),
          ...(metadata?.lastSeen !== undefined ? { lastSeen: new Date(metadata.lastSeen) } : {}),
          ...(metadata?.totalLineCount !== undefined ? { totalLineCount: metadata.totalLineCount } : {}),
          ...(metadata?.totalRequestCount !== undefined ? { totalRequestCount: metadata.totalRequestCount } : {}),
          ...(metadata?.observationSetVersion !== undefined
            ? { observationSetVersion: metadata.observationSetVersion }
            : {}),
          ...(metadata?.analyzerConfigurationVersion !== undefined
            ? { analyzerConfigurationVersion: metadata.analyzerConfigurationVersion }
            : {}),
          ...(metadata?.knownInformationDatasetVersion !== undefined
            ? { knownInformationDatasetVersion: metadata.knownInformationDatasetVersion }
            : {}),
        },
      });
      return toDomainAnalysis(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
}
