import { S3Client } from '@aws-sdk/client-s3';
import { ClerkAuthAdapter } from '@polaris/auth';
import { prisma } from '@polaris/db';
import { createAiExplanationQueue, createAnalyzerQueue, createProducerConnection } from '@polaris/queue';
import { loadEnv } from '@polaris/shared';
import { ensureBucket, S3TemporaryObjectStorage } from '@polaris/storage';
import type { ApiDeps } from './deps.js';
import { buildServer } from './server.js';

async function main(): Promise<void> {
  const env = loadEnv();

  // Fails loudly at startup rather than silently accepting a boot with no
  // real Auth Provider — same "required only once actually invoked"
  // pattern OPENAI_MODEL already established (50_Development_Setup_and_Seventh_Sprint.md decision 6).
  if (env.CLERK_SECRET_KEY === undefined) {
    throw new Error('CLERK_SECRET_KEY is required to start apps/api');
  }

  const s3Client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
  await ensureBucket(s3Client, env.S3_BUCKET);

  const connection = createProducerConnection(env.REDIS_URL);

  // Constructed once, at bootstrap — reuses CORS_ORIGIN as the sole
  // authorizedParties value (F-03; this app has exactly one Frontend
  // origin for the same reason CORS needs it).
  const authAdapter = new ClerkAuthAdapter({
    secretKey: env.CLERK_SECRET_KEY,
    authorizedParties: [env.CORS_ORIGIN],
  });

  const deps: ApiDeps = {
    prisma,
    storage: new S3TemporaryObjectStorage(s3Client, env.S3_BUCKET),
    analyzerQueue: createAnalyzerQueue(connection),
    aiExplanationQueue: createAiExplanationQueue(connection),
    authAdapter,
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
