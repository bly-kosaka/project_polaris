import { Readable } from 'node:stream';
import { S3Client } from '@aws-sdk/client-s3';
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureBucket } from '../ensure-bucket.js';
import { S3TemporaryObjectStorage } from '../s3-temporary-object-storage.js';
import { buildRawLogStorageKey } from '../storage-key.js';

const BUCKET = 'polaris-storage-tests';

const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  region: process.env.S3_REGION ?? 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'polaris',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'polaris123',
  },
});

async function streamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

describe('S3TemporaryObjectStorage', () => {
  const storage = new S3TemporaryObjectStorage(client, BUCKET);

  beforeAll(async () => {
    await ensureBucket(client, BUCKET);
  });

  it('round-trips put -> exists -> get -> delete -> exists', async () => {
    const key = buildRawLogStorageKey('analysis_storage_test');
    expect(key).toMatch(/^raw-logs\/analysis_storage_test\/[0-9a-f-]+$/);
    expect(key).not.toContain('original');

    const content = '192.0.2.1 - - [10/Oct/2023:17:00:00 +0000] "GET / HTTP/1.1" 200 100\n';
    await storage.putObject({ key, body: Readable.from([content]), contentType: 'text/plain' });

    expect(await storage.exists(key)).toBe(true);

    const stream = await storage.getObjectStream(key);
    expect(await streamToString(stream)).toBe(content);

    await storage.deleteObject(key);
    expect(await storage.exists(key)).toBe(false);
  });

  it('deleteObject on a missing key resolves successfully (idempotent delete)', async () => {
    const key = buildRawLogStorageKey('analysis_never_uploaded');
    await expect(storage.deleteObject(key)).resolves.toBeUndefined();
  });

  it('exists returns false for a key that was never put', async () => {
    const key = buildRawLogStorageKey('analysis_missing');
    expect(await storage.exists(key)).toBe(false);
  });

  it('streams a larger payload without buffering it into a single string first', async () => {
    const key = buildRawLogStorageKey('analysis_large');
    const lineCount = 50_000;
    const line = '203.0.113.1 - - [10/Oct/2023:17:00:00 +0000] "GET /path HTTP/1.1" 200 512\n';

    async function* generateLines() {
      for (let i = 0; i < lineCount; i += 1) yield line;
    }

    await storage.putObject({ key, body: Readable.from(generateLines()) });

    const stream = await storage.getObjectStream(key);
    let bytes = 0;
    for await (const chunk of stream) {
      bytes += (chunk as Buffer).length;
    }
    expect(bytes).toBe(line.length * lineCount);

    await storage.deleteObject(key);
  });
});
