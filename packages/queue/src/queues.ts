import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { AI_EXPLANATION_QUEUE, ANALYZER_QUEUE, MAINTENANCE_QUEUE } from './queue-names.js';

export function createAnalyzerQueue(connection: Redis): Queue {
  return new Queue(ANALYZER_QUEUE, { connection });
}

export function createMaintenanceQueue(connection: Redis): Queue {
  return new Queue(MAINTENANCE_QUEUE, { connection });
}

export function createAiExplanationQueue(connection: Redis): Queue {
  return new Queue(AI_EXPLANATION_QUEUE, { connection });
}
