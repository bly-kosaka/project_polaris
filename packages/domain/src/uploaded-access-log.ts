import type { RawLogDeletionStatus } from './status.js';

/**
 * `deleted` = normal post-persist lifecycle delete (success or fatal Analyzer
 * outcome); `expired` = Cleanup/Retention safety-net delete. Same underlying
 * storage delete, different terminal status recorded
 * (34_Development_Setup_and_Fourth_Sprint.md §13, 35_Sprint_4_Plan_Review.md F-13).
 */
export type UploadedAccessLogStatus = 'uploaded' | 'processing' | 'deleted' | 'expired';

export interface UploadedAccessLog {
  id: string;
  analysisId: string;
  originalFileName: string;
  sizeBytes: number;
  mimeType?: string;
  storageKey: string;
  status: UploadedAccessLogStatus;
  deletionStatus: RawLogDeletionStatus;
  createdAt: string;
  expiresAt: string;
  deletedAt?: string;
}
