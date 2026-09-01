import { validateObservationSet, type ObservationSet } from '@polaris/analyzer';
import type { ObservationSetRecord as PrismaObservationSetRecord } from '../generated/prisma/client.js';
import type { ObservationSetRecord } from './types.js';

/**
 * `data` is stored as JSON and re-typed here — always re-validated before
 * being trusted, never a bare cast, since the DB round-trip can't be
 * statically checked (31 §19/§43).
 */
export function toDomainObservationSetRecord(record: PrismaObservationSetRecord): ObservationSetRecord {
  const data = record.data as unknown as ObservationSet;
  validateObservationSet(data);
  return {
    id: record.id,
    analysisId: record.analysisId,
    schemaVersion: record.schemaVersion,
    data,
  };
}
