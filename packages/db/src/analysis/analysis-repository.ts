import type { Analysis, AnalysisStatus } from '@polaris/domain';
import type { AnalysisListItem, CreateAnalysisPersistenceInput, UpdateAnalysisPersistenceFields } from './types.js';

export interface AnalysisRepository {
  create(input: CreateAnalysisPersistenceInput): Promise<Analysis>;
  findById(id: string): Promise<Analysis | null>;
  listByProjectId(projectId: string): Promise<Analysis[]>;
  /**
   * Backs `GET /projects/{id}/analyses` — one query with joined
   * UploadedAccessLog/ObservationSetRecord, not N+1
   * (40_Sprint_5_Plan_Review.md §8/F-01).
   */
  listSummariesByProjectId(projectId: string): Promise<AnalysisListItem[]>;
  updateStatus(id: string, status: AnalysisStatus, fields?: UpdateAnalysisPersistenceFields): Promise<Analysis>;
  /**
   * Atomic `UPDATE ... WHERE id = ? AND status = ?` — the second-Worker
   * guard for `uploaded -> analyzing` (35_Sprint_4_Plan_Review.md F-07).
   * Returns whether this call was the one that made the change; a `false`
   * result means either another caller already made it, or `from` didn't
   * match the current row — the caller must re-read to tell which.
   */
  compareAndSetStatus(
    id: string,
    from: AnalysisStatus,
    to: AnalysisStatus,
    fields?: UpdateAnalysisPersistenceFields,
  ): Promise<boolean>;
}
