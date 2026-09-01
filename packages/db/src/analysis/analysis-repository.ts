import type { Analysis, AnalysisStatus } from '@polaris/domain';
import type { CreateAnalysisPersistenceInput, UpdateAnalysisPersistenceFields } from './types.js';

export interface AnalysisRepository {
  create(input: CreateAnalysisPersistenceInput): Promise<Analysis>;
  findById(id: string): Promise<Analysis | null>;
  listByProjectId(projectId: string): Promise<Analysis[]>;
  updateStatus(id: string, status: AnalysisStatus, fields?: UpdateAnalysisPersistenceFields): Promise<Analysis>;
}
