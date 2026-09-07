import type { PrismaClientLike } from '../client.js';
import { mapPrismaError } from '../errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import { toDomainAiExplanationRecord } from './mapper.js';
import type { AIExplanationRepository } from './ai-explanation-repository.js';
import type { AIExplanationRecord, CreateAIExplanationRecordInput } from './types.js';

export class PrismaAIExplanationRepository implements AIExplanationRepository {
  constructor(private readonly client: PrismaClientLike) {}

  async create(input: CreateAIExplanationRecordInput): Promise<AIExplanationRecord> {
    try {
      const record = await this.client.aIExplanationRecord.create({
        data: {
          analysisId: input.analysisId,
          schemaVersion: input.schemaVersion,
          promptVersion: input.promptVersion,
          provider: input.provider,
          model: input.model,
          data: input.data as unknown as Prisma.InputJsonValue,
          ...(input.providerResponseId !== undefined ? { providerResponseId: input.providerResponseId } : {}),
          ...(input.inputTokens !== undefined ? { inputTokens: input.inputTokens } : {}),
          ...(input.outputTokens !== undefined ? { outputTokens: input.outputTokens } : {}),
          ...(input.totalTokens !== undefined ? { totalTokens: input.totalTokens } : {}),
        },
      });
      return toDomainAiExplanationRecord(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async findByAnalysisId(analysisId: string): Promise<AIExplanationRecord | null> {
    try {
      const record = await this.client.aIExplanationRecord.findUnique({ where: { analysisId } });
      return record !== null ? toDomainAiExplanationRecord(record) : null;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
}
