import type { Project } from '@polaris/domain';
import type { PrismaClientLike } from '../client.js';
import { mapPrismaError } from '../errors.js';
import { toDomainProject } from './mapper.js';
import type { ProjectRepository } from './project-repository.js';
import type { CreateProjectPersistenceInput } from './types.js';

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
}
