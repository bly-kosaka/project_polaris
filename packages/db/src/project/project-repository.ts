import type { Project } from '@polaris/domain';
import type { CreateProjectPersistenceInput, ProjectListItem } from './types.js';

export interface ProjectRepository {
  create(input: CreateProjectPersistenceInput): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  /**
   * Backs `GET /projects` — one query, not N+1
   * (40_Sprint_5_Plan_Review.md §8, F-01 discussion).
   */
  listAllWithSummary(): Promise<ProjectListItem[]>;
}
