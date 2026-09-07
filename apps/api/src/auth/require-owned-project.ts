import { PrismaProjectRepository } from '@polaris/db';
import type { Project } from '@polaris/domain';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiDeps } from '../deps.js';
import { sendApiError } from '../errors.js';

/**
 * Looks up a Project scoped to `req.account.id` — a non-owned Project
 * returns 404 `PROJECT_NOT_FOUND`, identical to a truly nonexistent one
 * (anti-enumeration, no `PROJECT_FORBIDDEN` code ever introduced).
 * Returns `undefined` (having already sent the 404) on a miss — callers
 * must check for that before continuing.
 */
export async function requireOwnedProject(
  deps: ApiDeps,
  req: FastifyRequest,
  reply: FastifyReply,
  projectId: string,
): Promise<Project | undefined> {
  const project = await new PrismaProjectRepository(deps.prisma).findByIdForOwner(projectId, req.account.id);
  if (project === null) {
    sendApiError(reply, 404, 'PROJECT_NOT_FOUND', 'Project not found');
    return undefined;
  }
  return project;
}
