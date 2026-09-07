import type { Project } from '@polaris/domain';
import type { CreateProjectPersistenceInput, ProjectListItem } from './types.js';

export interface ProjectRepository {
  create(input: CreateProjectPersistenceInput): Promise<Project>;
  /** Unscoped — for internal/test/Worker code with no Account context. Never call this from a Route handler. */
  findById(id: string): Promise<Project | null>;
  /**
   * Backs `GET /projects` — one query, not N+1
   * (40_Sprint_5_Plan_Review.md §8, F-01 discussion).
   */
  listAllWithSummary(): Promise<ProjectListItem[]>;
  /**
   * Ownership-scoped equivalents (Sprint 7,
   * 50_Development_Setup_and_Seventh_Sprint.md §13) — the filter lives in
   * the SQL `where` itself, never "fetch then compare in JS." Every Route
   * handler must use these, never the unscoped versions above.
   */
  findByIdForOwner(id: string, ownerAccountId: string): Promise<Project | null>;
  listAllWithSummaryForOwner(ownerAccountId: string): Promise<ProjectListItem[]>;
}
