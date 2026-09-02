export interface CreateUploadedAccessLogPersistenceInput {
  analysisId: string;
  originalFileName: string;
  sizeBytes: number;
  mimeType?: string;
  storageKey: string;
  expiresAt: string;
}

export type MarkDeletionSuccessReason = 'normal' | 'expired';
