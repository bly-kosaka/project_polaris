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
  /**
   * Read from env by index.ts's loadEnv() and passed in here — buildServer()
   * stays a pure, deterministic factory, never reading process.env itself
   * (40_Sprint_5_Plan_Review.md F-04).
   */
  corsOrigin: string;
}
