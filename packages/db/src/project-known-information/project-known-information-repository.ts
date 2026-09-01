import type { CreateProjectKnownInformationInput, ProjectKnownInformation } from './types.js';

export interface ProjectKnownInformationRepository {
  create(input: CreateProjectKnownInformationInput): Promise<ProjectKnownInformation>;
  findById(id: string): Promise<ProjectKnownInformation | null>;
  listByProjectId(projectId: string): Promise<ProjectKnownInformation[]>;
}
