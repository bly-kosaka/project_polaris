import { describe, expect, it } from 'vitest';
import { createProducerConnection, createWorkerConnection } from '../connection.js';

describe('connection', () => {
  it('producer connection fails fast on an unreachable Redis instead of hanging (T-10 precondition)', async () => {
    // Port 1 is not Redis and nothing is listening on it locally — simulates
    // "Redis is down" without needing to actually stop the Docker container.
    const connection = createProducerConnection('redis://127.0.0.1:1');
    connection.on('error', () => {}); // expected — asserted via the rejection below, not this listener
    try {
      await expect(connection.ping()).rejects.toThrow();
    } finally {
      connection.disconnect();
    }
  }, 10000);

  it('createWorkerConnection connects successfully against the real local Redis', async () => {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:16379';
    const connection = createWorkerConnection(redisUrl);
    try {
      await expect(connection.ping()).resolves.toBe('PONG');
    } finally {
      connection.disconnect();
    }
  });
});
