import type { KnownInformationMatchType } from '@polaris/analyzer';

export interface ProjectKnownInformation {
  id: string;
  projectId: string;
  target: 'path';
  matchType: KnownInformationMatchType;
  pattern: string;
  title: string;
  description?: string;
  enabled: boolean;
}

export interface CreateProjectKnownInformationInput {
  projectId: string;
  matchType: KnownInformationMatchType;
  pattern: string;
  title: string;
  description?: string;
  enabled?: boolean;
}
