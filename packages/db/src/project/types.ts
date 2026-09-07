import type { Project } from '@polaris/domain';

export interface CreateProjectPersistenceInput {
  name: string;
  description?: string;
  primaryUrl?: string;
  hostname?: string;
  /** Set from the Authenticated Account server-side — never client-supplied (Sprint 7). */
  ownerAccountId: string;
}

/**
 * Project + the two fields the Project List screen needs
 * (39_Development_Setup_and_Fifth_Sprint.md §17) computed in the same
 * single query as the list itself — never a per-row follow-up query.
 */
export interface ProjectListItem extends Project {
  analysisCount: number;
  latestAnalysisAt?: string;
}
