import { PrismaAnalysisRepository, PrismaProjectRepository } from '@polaris/db';
import type { FastifyInstance } from 'fastify';
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

    const project = await new PrismaProjectRepository(deps.prisma).create({ name });
    return reply.code(201).send(toProjectDetailDto(project));
  });

  app.get('/projects', async (_req, reply) => {
    const list = await new PrismaProjectRepository(deps.prisma).listAllWithSummary();
    return reply.send(list.map(toProjectSummaryDto));
  });

  app.get<{ Params: { projectId: string } }>('/projects/:projectId', async (req, reply) => {
    const project = await new PrismaProjectRepository(deps.prisma).findById(req.params.projectId);
    if (project === null) {
      return sendApiError(reply, 404, 'PROJECT_NOT_FOUND', 'Project not found');
    }
    return reply.send(toProjectDetailDto(project));
  });

  app.get<{ Params: { projectId: string } }>('/projects/:projectId/analyses', async (req, reply) => {
    const project = await new PrismaProjectRepository(deps.prisma).findById(req.params.projectId);
    if (project === null) {
      return sendApiError(reply, 404, 'PROJECT_NOT_FOUND', 'Project not found');
    }
    const list = await new PrismaAnalysisRepository(deps.prisma).listSummariesByProjectId(req.params.projectId);
    return reply.send(list.map(toAnalysisSummaryDto));
  });
}
