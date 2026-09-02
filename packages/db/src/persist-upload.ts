import type { Analysis, UploadedAccessLog } from '@polaris/domain';
import type { PrismaClient } from './generated/prisma/client.js';
import { PrismaAnalysisRepository } from './analysis/prisma-analysis-repository.js';
import { PrismaUploadedAccessLogRepository } from './uploaded-access-log/prisma-uploaded-access-log-repository.js';

/**
 * Wraps the UploadedAccessLog insert and the Analysis `created -> uploaded`
 * update in one transaction — a caller previously calling both repositories
 * sequentially could leave a half-persisted state (UploadedAccessLog exists,
 * Analysis still `created`) if the second write failed
 * (35_Sprint_4_Plan_Review.md F-04). On failure, the caller is expected to
 * best-effort delete the already-uploaded Storage object.
 */
export async function persistUploadedAccessLog(
  prisma: PrismaClient,
  params: {
    analysisId: string;
    originalFileName: string;
    sizeBytes: number;
    mimeType?: string;
    storageKey: string;
    expiresAt: string;
  },
): Promise<{ uploadedAccessLog: UploadedAccessLog; analysis: Analysis }> {
  return prisma.$transaction(async (tx) => {
    const uploadedAccessLog = await new PrismaUploadedAccessLogRepository(tx).create(params);
    const analysis = await new PrismaAnalysisRepository(tx).updateStatus(params.analysisId, 'uploaded');
    return { uploadedAccessLog, analysis };
  });
}
