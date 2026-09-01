import type { PrismaClientLike } from '../client.js';
import { toPrismaKnownInformationMatchType } from '../enum-mappers.js';
import { mapPrismaError } from '../errors.js';
import { toDomainProjectKnownInformation } from './mapper.js';
import type { ProjectKnownInformationRepository } from './project-known-information-repository.js';
import type { CreateProjectKnownInformationInput, ProjectKnownInformation } from './types.js';

export class PrismaProjectKnownInformationRepository implements ProjectKnownInformationRepository {
  constructor(private readonly client: PrismaClientLike) {}

  async create(input: CreateProjectKnownInformationInput): Promise<ProjectKnownInformation> {
    try {
      const record = await this.client.projectKnownInformation.create({
        data: {
          projectId: input.projectId,
          matchType: toPrismaKnownInformationMatchType(input.matchType),
          pattern: input.pattern,
          title: input.title,
          description: input.description ?? null,
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        },
      });
      return toDomainProjectKnownInformation(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async findById(id: string): Promise<ProjectKnownInformation | null> {
    try {
      const record = await this.client.projectKnownInformation.findUnique({ where: { id } });
      return record !== null ? toDomainProjectKnownInformation(record) : null;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async listByProjectId(projectId: string): Promise<ProjectKnownInformation[]> {
    try {
      const records = await this.client.projectKnownInformation.findMany({ where: { projectId } });
      return records.map(toDomainProjectKnownInformation);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
}
