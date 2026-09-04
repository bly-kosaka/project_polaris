import type { Project, ProjectStatus } from '@polaris/domain';
import type { ProjectListItem } from '@polaris/db';

/** Backs `GET /projects` — no Prisma shape, no storageKey/credentials ever included. */
export interface ProjectSummaryDto {
  id: string;
  name: string;
  analysisCount: number;
  latestAnalysisAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Backs `POST /projects` and `GET /projects/:projectId`. */
export interface ProjectDetailDto {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export function toProjectSummaryDto(item: ProjectListItem): ProjectSummaryDto {
  return {
    id: item.id,
    name: item.name,
    analysisCount: item.analysisCount,
    ...(item.latestAnalysisAt !== undefined ? { latestAnalysisAt: item.latestAnalysisAt } : {}),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function toProjectDetailDto(project: Project): ProjectDetailDto {
  return {
    id: project.id,
    name: project.name,
    ...(project.description !== undefined ? { description: project.description } : {}),
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}
