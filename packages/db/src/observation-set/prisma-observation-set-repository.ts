import type { PrismaClientLike } from '../client.js';
import { mapPrismaError } from '../errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import { toDomainObservationSetRecord } from './mapper.js';
import type { ObservationSetRepository } from './observation-set-repository.js';
import type { CreateObservationSetRecordInput, ObservationSetRecord } from './types.js';

export class PrismaObservationSetRepository implements ObservationSetRepository {
  constructor(private readonly client: PrismaClientLike) {}

  async create(input: CreateObservationSetRecordInput): Promise<ObservationSetRecord> {
    try {
      const record = await this.client.observationSetRecord.create({
        data: {
          analysisId: input.analysisId,
          schemaVersion: input.schemaVersion,
          data: input.data as unknown as Prisma.InputJsonValue,
        },
      });
      return toDomainObservationSetRecord(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async findByAnalysisId(analysisId: string): Promise<ObservationSetRecord | null> {
    try {
      const record = await this.client.observationSetRecord.findUnique({ where: { analysisId } });
      return record !== null ? toDomainObservationSetRecord(record) : null;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
}
