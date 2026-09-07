import type { AIModelConfig, AIProvider } from '@polaris/ai';
import type { prisma } from '@polaris/db';
import type { AIExplanationJobData } from '@polaris/queue';
import type { TemporaryObjectStorage } from '@polaris/storage';
import type { Queue } from 'bullmq';

/**
 * `prisma: typeof prisma` reuses the singleton's inferred type without
 * `@polaris/db` needing to publicly export the PrismaClient type itself —
 * only the ready-made `prisma` value and the narrower `PrismaClientLike`
 * union are exported today.
 *
 * `aiProvider`/`aiModelConfig` are injected dependencies, not resolved
 * inside the Job Handler (46_Sprint_6_Plan_Final_Review.md F-06) — Worker
 * bootstrap (`index.ts`) is the only place that ever calls
 * `selectProvider()`/`resolveAiModelConfig()`; tests substitute a
 * `FakeAIProvider` for `aiProvider` directly, no module mocking required.
 */
export interface WorkerDeps {
  prisma: typeof prisma;
  storage: TemporaryObjectStorage;
  maintenanceQueue: Queue;
  aiExplanationQueue: Queue<AIExplanationJobData>;
  aiModelConfig: AIModelConfig;
  aiProvider: AIProvider;
}
