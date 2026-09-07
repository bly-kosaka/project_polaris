import { PrismaAnalysisRepository, PrismaProjectRepository } from '@polaris/db';
import type { FastifyInstance } from 'fastify';
import { requireOwnedProject } from '../auth/require-owned-project.js';
import type { ApiDeps } from '../deps.js';
import { toAnalysisSummaryDto } from '../dto/analysis.js';
import { toProjectDetailDto, toProjectSummaryDto } from '../dto/project.js';
import { sendApiError } from '../errors.js';

const MAX_PROJECT_NAME_LENGTH = 200;

export function registerProjectsRoutes(app: FastifyInstance, deps: ApiDeps): void {
  app.post<{ Body: { name?: unknown } }>('/projects', async (req, reply) => {
    const rawName = req.body?.name;
    if (typeof rawName !== 'string') {
      return sendApiError(reply, 400, 'VALIDATION_ERROR', 'name is required');
    }
    const name = rawName.trim();
    if (name.length === 0) {
      return sendApiError(reply, 400, 'VALIDATION_ERROR', 'name must not be empty');
    }
    if (name.length > MAX_PROJECT_NAME_LENGTH) {
      return sendApiError(
        reply,
        400,
        'VALIDATION_ERROR',
        `name must be at most ${MAX_PROJECT_NAME_LENGTH} characters`,
      );
    }

    // Client never supplies its own ownerAccountId — the Account provisioned
    // by the global authenticate hook is the sole source (50_Development_Setup_and_Seventh_Sprint.md §35).
    const project = await new PrismaProjectRepository(deps.prisma).create({ name, ownerAccountId: req.account.id });
    return reply.code(201).send(toProjectDetailDto(project));
  });

  app.get('/projects', async (req, reply) => {
    const list = await new PrismaProjectRepository(deps.prisma).listAllWithSummaryForOwner(req.account.id);
    return reply.send(list.map(toProjectSummaryDto));
  });

  app.get<{ Params: { projectId: string } }>('/projects/:projectId', async (req, reply) => {
    const project = await requireOwnedProject(deps, req, reply, req.params.projectId);
    if (project === undefined) return;
    return reply.send(toProjectDetailDto(project));
  });

  app.get<{ Params: { projectId: string } }>('/projects/:projectId/analyses', async (req, reply) => {
    const project = await requireOwnedProject(deps, req, reply, req.params.projectId);
    if (project === undefined) return;
    const list = await new PrismaAnalysisRepository(deps.prisma).listSummariesByProjectId(project.id);
    return reply.send(list.map(toAnalysisSummaryDto));
  });
}
