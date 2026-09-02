import type { UploadedAccessLog } from '@polaris/domain';
import type { CreateUploadedAccessLogPersistenceInput, MarkDeletionSuccessReason } from './types.js';

/**
 * Named transition methods instead of generic `update()` setters — a caller
 * updating `deletionStatus` while forgetting `status`/`deletedAt` was the
 * exact gap 35_Sprint_4_Plan_Review.md F-13 found in an earlier draft.
 */
export interface UploadedAccessLogRepository {
  create(input: CreateUploadedAccessLogPersistenceInput): Promise<UploadedAccessLog>;
  findByAnalysisId(analysisId: string): Promise<UploadedAccessLog | null>;
  markProcessing(analysisId: string): Promise<UploadedAccessLog>;
  markDeletionSuccess(analysisId: string, params: { reason: MarkDeletionSuccessReason }): Promise<UploadedAccessLog>;
  markDeletionFailed(analysisId: string): Promise<UploadedAccessLog>;
  /**
   * Rows past their retention window that haven't been deleted through the
   * normal lifecycle — the Cleanup Job's candidate set
   * (34_Development_Setup_and_Fourth_Sprint.md §38). Excludes both `deleted`
   * and `expired` (already handled), not just `deleted`.
   */
  findExpiredCandidates(now: Date): Promise<UploadedAccessLog[]>;
}
