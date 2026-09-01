import type { CreateObservationSetRecordInput, ObservationSetRecord } from './types.js';

export interface ObservationSetRepository {
  create(input: CreateObservationSetRecordInput): Promise<ObservationSetRecord>;
  findByAnalysisId(analysisId: string): Promise<ObservationSetRecord | null>;
}
