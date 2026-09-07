import type { FastifyReply } from 'fastify';

/**
 * Every route responds with this shape on error
 * (39_Development_Setup_and_Fifth_Sprint.md §13) — never a bare exception
 * message, and never the raw Prisma/Storage error a lower layer produced.
 */
export type ApiErrorCode =
  | 'PROJECT_NOT_FOUND'
  | 'ANALYSIS_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'ANALYSIS_NOT_IN_CREATED_STATE'
  | 'UPLOAD_ALREADY_EXISTS'
  | 'FILE_REQUIRED'
  | 'FILE_EMPTY'
  | 'UPLOAD_TOO_LARGE'
  | 'STORAGE_PUT_FAILED'
  | 'UPLOAD_PERSIST_FAILED'
  | 'OBSERVATION_SET_NOT_READY'
  | 'ANALYSIS_FAILED'
  | 'AI_EXPLANATION_NOT_READY'
  | 'AI_EXPLANATION_FAILED'
  | 'AI_EXPLANATION_ALREADY_EXISTS'
  | 'INTERNAL_ERROR';

export function sendApiError(reply: FastifyReply, status: number, code: ApiErrorCode, message: string) {
  return reply.code(status).send({ error: { code, message } });
}
