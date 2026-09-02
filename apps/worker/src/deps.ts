import type { prisma } from '@polaris/db';
import type { TemporaryObjectStorage } from '@polaris/storage';
import type { Queue } from 'bullmq';

/**
 * `prisma: typeof prisma` reuses the singleton's inferred type without
 * `@polaris/db` needing to publicly export the PrismaClient type itself —
 * only the ready-made `prisma` value and the narrower `PrismaClientLike`
 * union are exported today.
 */
export interface WorkerDeps {
  prisma: typeof prisma;
  storage: TemporaryObjectStorage;
  maintenanceQueue: Queue;
}
