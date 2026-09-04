import { apiFetch } from './client';
import type { AnalysisSummaryDto, ProjectDetailDto, ProjectSummaryDto } from '../types/dto';

export async function createProject(name: string): Promise<ProjectDetailDto> {
  return apiFetch<ProjectDetailDto>('/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export async function listProjects(): Promise<ProjectSummaryDto[]> {
  return apiFetch<ProjectSummaryDto[]>('/projects');
}

export async function getProject(projectId: string): Promise<ProjectDetailDto> {
  return apiFetch<ProjectDetailDto>(`/projects/${encodeURIComponent(projectId)}`);
}

export async function listProjectAnalyses(projectId: string): Promise<AnalysisSummaryDto[]> {
  return apiFetch<AnalysisSummaryDto[]>(`/projects/${encodeURIComponent(projectId)}/analyses`);
}
