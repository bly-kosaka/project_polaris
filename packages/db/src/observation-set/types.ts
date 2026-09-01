import type { ObservationSet } from '@polaris/analyzer';

export interface ObservationSetRecord {
  id: string;
  analysisId: string;
  schemaVersion: string;
  data: ObservationSet;
}

export interface CreateObservationSetRecordInput {
  analysisId: string;
  schemaVersion: string;
  data: ObservationSet;
}
