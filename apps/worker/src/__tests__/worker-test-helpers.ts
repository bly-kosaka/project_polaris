import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { S3Client } from '@aws-sdk/client-s3';
import type { AIProvider } from '@polaris/ai';
import {
  PrismaAnalysisRepository,
  PrismaProjectRepository,
  persistUploadedAccessLog,
  prisma,
} from '@polaris/db';
import { createAiExplanationQueue, createWorkerConnection, createMaintenanceQueue } from '@polaris/queue';
import type { AIExplanationJobData, AnalyzerJobData } from '@polaris/queue';
import { buildRawLogStorageKey, ensureBucket, S3TemporaryObjectStorage } from '@polaris/storage';
import type { Job } from 'bullmq';
import { handleAnalyzerJob } from '../analyzer-job-handler.js';
import type { WorkerDeps } from '../deps.js';
import { FakeAIProvider } from './fake-ai-provider.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

export const BUCKET = 'polaris-worker-tests';

export async function resetDatabase(): Promise<void> {
  await prisma.aIExplanationRecord.deleteMany();
  await prisma.billingWebhookEvent.deleteMany();
  await prisma.usageEvent.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.billingCustomer.deleteMany();
  await prisma.observationSetRecord.deleteMany();
  await prisma.analysisExecution.deleteMany();
  await prisma.uploadedAccessLog.deleteMany();
  await prisma.analysis.deleteMany();
  await prisma.projectKnownInformation.deleteMany();
  await prisma.project.deleteMany();
  await prisma.account.deleteMany();
}

export async function createTestAccount(): Promise<{ id: string }> {
  return prisma.account.create({ data: { authProvider: 'clerk', authSubject: `test-subject-${Date.now()}-${Math.random()}`, emailVerified: true } });
}

export function readFixture(name: string): string {
  return readFileSync(path.join(repoRoot, 'fixtures', 'access-logs', name), 'utf-8');
}

/**
 * `connection` is returned alongside (not inside) `WorkerDeps` — production
 * code never carries a raw Redis connection in WorkerDeps, only the
 * pre-built `maintenanceQueue`. Tests that need to build their own
 * short-lived analyzer Queue/Worker (bullmq-test-helpers.ts, for real
 * retry/backoff behavior — M-04) reuse this connection rather than each
 * opening a separate one.
 */
export async function buildWorkerDeps(
  options: { aiProvider?: AIProvider } = {},
): Promise<
  WorkerDeps & { connection: ReturnType<typeof createWorkerConnection>; close: () => Promise<void> }
> {
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
  const aiExplanationQueue = createAiExplanationQueue(connection);
  await aiExplanationQueue.obliterate({ force: true });

  return {
    prisma,
    storage,
    maintenanceQueue,
    aiExplanationQueue,
    // The OpenAI Adapter/Registry are never constructed in tests — this is
    // the literal DI seam (46_Sprint_6_Plan_Final_Review.md F-06), not a
    // module mock.
    aiProvider: options.aiProvider ?? new FakeAIProvider(),
    aiModelConfig: {
      provider: 'openai',
      model: 'fake-model',
      maxOutputTokens: 4096,
      timeoutMs: 90000,
      maxInputBytes: 200000,
      providerOptions: { reasoningEffort: 'medium' },
    },
    connection,
    close: async () => {
      await maintenanceQueue.close();
      await aiExplanationQueue.close();
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
  const account = await createTestAccount();
  const project = await new PrismaProjectRepository(deps.prisma).create({ name: `Worker Test ${Date.now()}`, ownerAccountId: account.id });
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

/**
 * Runs the real Analyzer pipeline end-to-end (via `setUpUploadedAnalysis` +
 * `handleAnalyzerJob`) to reach a genuine `analyzer_result_ready` Analysis
 * with a real ObservationSet and a real AI Explanation Job already queued
 * (via `scheduleInitialAiExplanation`) — the realistic precondition for AI
 * Job Handler tests, rather than a hand-rolled ObservationSet that could
 * drift from the real shape.
 */
export async function setUpAnalysisReadyForAiExplanation(
  deps: WorkerDeps,
  fixtureName = 'valid.log',
): Promise<{ analysisId: string }> {
  const { analysisId } = await setUpUploadedAnalysis(deps, fixtureName);
  await handleAnalyzerJob(fakeJob(analysisId), deps);
  return { analysisId };
}

export function fakeJob(analysisId: string, attemptsStarted = 1, attempts = 3): Job<AnalyzerJobData> {
  return {
    data: { analysisId },
    attemptsStarted,
    opts: { attempts },
  } as unknown as Job<AnalyzerJobData>;
}

export function fakeAiExplanationJob(analysisId: string, attemptsStarted = 1, attempts = 3): Job<AIExplanationJobData> {
  return {
    data: { analysisId },
    attemptsStarted,
    opts: { attempts },
  } as unknown as Job<AIExplanationJobData>;
}
