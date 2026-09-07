export type ProjectStatus = 'active' | 'archived';

export interface Project {
  id: string;
  name: string;
  description?: string;
  site?: {
    primaryUrl?: string;
    hostname?: string;
  };
  status: ProjectStatus;
  /** The Account that owns this Project — never client-supplied (Sprint 7). */
  ownerAccountId: string;
  createdAt: string;
  updatedAt: string;
}
