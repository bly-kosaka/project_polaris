import type { Project } from '@polaris/domain';
import type { CreateProjectPersistenceInput } from './types.js';

export interface ProjectRepository {
  create(input: CreateProjectPersistenceInput): Promise<Project>;
  findById(id: string): Promise<Project | null>;
}
