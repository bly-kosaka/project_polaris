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
  createdAt: string;
  updatedAt: string;
}
