import type { Project } from '@polaris/domain';
import type { PrismaClientLike } from '../client.js';
import { mapPrismaError } from '../errors.js';
import { toDomainProject } from './mapper.js';
import type { ProjectRepository } from './project-repository.js';
import type { CreateProjectPersistenceInput, ProjectListItem } from './types.js';

export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly client: PrismaClientLike) {}

  async create(input: CreateProjectPersistenceInput): Promise<Project> {
    try {
      const record = await this.client.project.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          primaryUrl: input.primaryUrl ?? null,
          hostname: input.hostname ?? null,
          ownerAccountId: input.ownerAccountId,
        },
      });
      return toDomainProject(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async findById(id: string): Promise<Project | null> {
    try {
      const record = await this.client.project.findUnique({ where: { id } });
      return record !== null ? toDomainProject(record) : null;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async listAllWithSummary(): Promise<ProjectListItem[]> {
    try {
      const records = await this.client.project.findMany({
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: { select: { analyses: true } },
          analyses: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
        },
      });
      return records.map((record) => ({
        ...toDomainProject(record),
        analysisCount: record._count.analyses,
        ...(record.analyses[0] !== undefined ? { latestAnalysisAt: record.analyses[0].createdAt.toISOString() } : {}),
      }));
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async findByIdForOwner(id: string, ownerAccountId: string): Promise<Project | null> {
    try {
      const record = await this.client.project.findFirst({ where: { id, ownerAccountId } });
      return record !== null ? toDomainProject(record) : null;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async listAllWithSummaryForOwner(ownerAccountId: string): Promise<ProjectListItem[]> {
    try {
      const records = await this.client.project.findMany({
        where: { ownerAccountId },
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: { select: { analyses: true } },
          analyses: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
        },
      });
      return records.map((record) => ({
        ...toDomainProject(record),
        analysisCount: record._count.analyses,
        ...(record.analyses[0] !== undefined ? { latestAnalysisAt: record.analyses[0].createdAt.toISOString() } : {}),
      }));
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
}
