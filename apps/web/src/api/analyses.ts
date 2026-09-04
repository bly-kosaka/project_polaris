import { apiFetch } from './client';
import { observationSetSchema, type ObservationSetDto } from './schemas';
import type { AnalysisDetailDto } from '../types/dto';

export async function createAnalysis(projectId: string): Promise<{ analysisId: string; status: string }> {
  return apiFetch<{ analysisId: string; status: string }>(`/projects/${encodeURIComponent(projectId)}/analyses`, {
    method: 'POST',
  });
}

export async function uploadAccessLog(
  analysisId: string,
  file: File,
): Promise<{ analysisId: string; status: string; enqueueFailed?: boolean }> {
  const form = new FormData();
  form.append('file', file, file.name);
  return apiFetch<{ analysisId: string; status: string; enqueueFailed?: boolean }>(
    `/analyses/${encodeURIComponent(analysisId)}/upload`,
    { method: 'POST', body: form },
  );
}

export async function getAnalysis(analysisId: string, signal?: AbortSignal): Promise<AnalysisDetailDto> {
  return apiFetch<AnalysisDetailDto>(`/analyses/${encodeURIComponent(analysisId)}`, {
    ...(signal !== undefined ? { signal } : {}),
  });
}

export class ObservationSetParseError extends Error {
  constructor(cause: unknown) {
    super('The ObservationSet response did not match the expected shape');
    this.name = 'ObservationSetParseError';
    this.cause = cause;
  }
}

export async function getObservationSet(analysisId: string): Promise<ObservationSetDto> {
  const raw = await apiFetch<unknown>(`/analyses/${encodeURIComponent(analysisId)}/observations`);
  const result = observationSetSchema.safeParse(raw);
  if (!result.success) {
    throw new ObservationSetParseError(result.error);
  }
  return result.data;
}
