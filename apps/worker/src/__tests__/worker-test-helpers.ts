import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { S3Client } from '@aws-sdk/client-s3';
import {
  PrismaAnalysisRepository,
  PrismaProjectRepository,
  persistUploadedAccessLog,
  prisma,
} from '@polaris/db';
import { createWorkerConnection, createMaintenanceQueue } from '@polaris/queue';
import type { AnalyzerJobData } from '@polaris/queue';
import { buildRawLogStorageKey, ensureBucket, S3TemporaryObjectStorage } from '@polaris/storage';
import type { Job } from 'bullmq';
import type { WorkerDeps } from '../deps.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

export const BUCKET = 'polaris-worker-tests';

export async function resetDatabase(): Promise<void> {
  await prisma.observationSetRecord.deleteMany();
  await prisma.analysisExecution.deleteMany();
  await prisma.uploadedAccessLog.deleteMany();
  await prisma.analysis.deleteMany();
  await prisma.projectKnownInformation.deleteMany();
  await prisma.project.deleteMany();
}

export function readFixture(name: string): string {
  return readFileSync(path.join(repoRoot, 'fixtures', 'access-logs', name), 'utf-8');
}

export async function buildWorkerDeps(): Promise<WorkerDeps & { close: () => Promise<void> }> {
  const s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'polaris',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'polaris123',
    },
  });
  await ensureBucket(s3Client, BUCKET);
  const storage = new S3TemporaryObjectStorage(s3Client, BUCKET);

  const connection = createWorkerConnection(process.env.REDIS_URL ?? 'redis://localhost:16379');
  const maintenanceQueue = createMaintenanceQueue(connection);
  await maintenanceQueue.obliterate({ force: true });

  return {
    prisma,
    storage,
    maintenanceQueue,
    close: async () => {
      await maintenanceQueue.close();
      connection.disconnect();
    },
  };
}

/**
 * Creates a Project + Analysis + a real uploaded fixture object in Storage,
 * with the Analysis advanced to `uploaded` via persistUploadedAccessLog —
 * a valid pre-state for the Worker to pick up, matching what the real
 * upload API route would have produced.
 */
export async function setUpUploadedAnalysis(
  deps: WorkerDeps,
  fixtureName: string,
): Promise<{ analysisId: string; storageKey: string }> {
  const project = await new PrismaProjectRepository(deps.prisma).create({ name: `Worker Test ${Date.now()}` });
  const analysis = await new PrismaAnalysisRepository(deps.prisma).create({ projectId: project.id });
  const storageKey = buildRawLogStorageKey(analysis.id);
  const content = readFixture(fixtureName);

  await deps.storage.putObject({ key: storageKey, body: Readable.from([content]), contentType: 'text/plain' });
  await persistUploadedAccessLog(deps.prisma, {
    analysisId: analysis.id,
    originalFileName: fixtureName,
    sizeBytes: Buffer.byteLength(content),
    storageKey,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  return { analysisId: analysis.id, storageKey };
}

export function fakeJob(analysisId: string, attemptsStarted = 1, attempts = 3): Job<AnalyzerJobData> {
  return {
    data: { analysisId },
    attemptsStarted,
    opts: { attempts },
  } as unknown as Job<AnalyzerJobData>;
}
