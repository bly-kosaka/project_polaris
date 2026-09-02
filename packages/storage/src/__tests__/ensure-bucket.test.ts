import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';
import { ensureBucket } from '../ensure-bucket.js';

const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  region: process.env.S3_REGION ?? 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'polaris',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'polaris123',
  },
});

describe('ensureBucket', () => {
  it('creates the bucket if missing and is idempotent when called again', async () => {
    const bucket = `polaris-ensure-bucket-test-${Date.now()}`;
    await ensureBucket(client, bucket);
    await expect(client.send(new HeadBucketCommand({ Bucket: bucket }))).resolves.toBeDefined();

    // Second call must not throw even though the bucket already exists.
    await expect(ensureBucket(client, bucket)).resolves.toBeUndefined();
  });
});
