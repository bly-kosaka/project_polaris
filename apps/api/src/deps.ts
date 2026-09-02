import type { prisma } from '@polaris/db';
import type { AnalyzerJobData } from '@polaris/queue';
import type { TemporaryObjectStorage } from '@polaris/storage';
import type { Queue } from 'bullmq';

export interface ApiDeps {
  prisma: typeof prisma;
  storage: TemporaryObjectStorage;
  analyzerQueue: Queue<AnalyzerJobData>;
  maxUploadBytes: number;
  rawLogRetentionHours: number;
}
