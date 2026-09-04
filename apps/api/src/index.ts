import { S3Client } from '@aws-sdk/client-s3';
import { prisma } from '@polaris/db';
import { createAnalyzerQueue, createProducerConnection } from '@polaris/queue';
import { loadEnv } from '@polaris/shared';
import { ensureBucket, S3TemporaryObjectStorage } from '@polaris/storage';
import type { ApiDeps } from './deps.js';
import { buildServer } from './server.js';

async function main(): Promise<void> {
  const env = loadEnv();

  const s3Client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
  await ensureBucket(s3Client, env.S3_BUCKET);

  const connection = createProducerConnection(env.REDIS_URL);

  const deps: ApiDeps = {
    prisma,
    storage: new S3TemporaryObjectStorage(s3Client, env.S3_BUCKET),
    analyzerQueue: createAnalyzerQueue(connection),
    maxUploadBytes: env.MAX_UPLOAD_BYTES,
    rawLogRetentionHours: env.RAW_LOG_RETENTION_HOURS,
    corsOrigin: env.CORS_ORIGIN,
  };

  const app = await buildServer(deps);
  await app.listen({ port: 3001, host: '0.0.0.0' });
}

main().catch((error: unknown) => {
  console.error('API failed to start', error);
  process.exitCode = 1;
});
