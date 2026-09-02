import { Redis } from 'ioredis';

/**
 * `protocol: 2` pins the RESP2 wire protocol explicitly — ioredis 6 defaults
 * to RESP3, which is new territory for this BullMQ version pairing; RESP2 is
 * BullMQ's long-established, well-tested protocol (35_Sprint_4_Plan_Review.md's
 * own instruction to confirm real installed-package behavior rather than
 * assume it, applied conservatively here).
 */
function baseOptions() {
  return { protocol: 2 as const };
}

/**
 * Used by `apps/api` (the enqueue producer). Finite `maxRetriesPerRequest`
 * so an enqueue call fails fast if Redis is down instead of blocking the
 * HTTP request indefinitely — required for
 * 34_Development_Setup_and_Fourth_Sprint.md §25's "enqueue failure -> Analysis
 * stays uploaded" to actually be reachable (35_Sprint_4_Plan_Review.md F-02).
 */
export function createProducerConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, { ...baseOptions(), maxRetriesPerRequest: 1 });
}

/**
 * Used by `apps/worker`. `maxRetriesPerRequest: null` is BullMQ's documented
 * requirement for Worker connections — a Worker should block and wait for
 * Redis to come back rather than fail a command outright.
 */
export function createWorkerConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, { ...baseOptions(), maxRetriesPerRequest: null });
}
