import { PrismaAnalysisRepository } from '@polaris/db';
import type { Analysis } from '@polaris/domain';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiDeps } from '../deps.js';
import { sendApiError } from '../errors.js';

/**
 * Looks up an Analysis scoped to `req.account.id` (via the
 * `project.ownerAccountId` join) — a non-owned Analysis returns 404
 * `ANALYSIS_NOT_FOUND`, identical to a truly nonexistent one
 * (anti-enumeration). Returns `undefined` (having already sent the 404) on
 * a miss — callers must check for that before continuing.
 */
export async function requireOwnedAnalysis(
  deps: ApiDeps,
  req: FastifyRequest,
  reply: FastifyReply,
  analysisId: string,
): Promise<Analysis | undefined> {
  const analysis = await new PrismaAnalysisRepository(deps.prisma).findByIdForOwner(analysisId, req.account.id);
  if (analysis === null) {
    sendApiError(reply, 404, 'ANALYSIS_NOT_FOUND', 'Analysis not found');
    return undefined;
  }
  return analysis;
}
