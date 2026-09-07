import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client } from '@aws-sdk/client-s3';
import { analyzeAccessLog } from '@polaris/analyzer';
import { PrismaAnalysisRepository, PrismaProjectRepository, persistAnalyzerSuccess, prisma } from '@polaris/db';
import { createAiExplanationQueue, createAnalyzerQueue, createProducerConnection } from '@polaris/queue';
import { ensureBucket, S3TemporaryObjectStorage } from '@polaris/storage';
import type { ApiDeps } from '../deps.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

export const BUCKET = 'polaris-api-tests';

export async function resetDatabase(): Promise<void> {
  await prisma.aIExplanationRecord.deleteMany();
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

export async function buildApiDeps(maxUploadBytes = 52428800): Promise<ApiDeps & { close: () => Promise<void> }> {
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

  const connection = createProducerConnection(process.env.REDIS_URL ?? 'redis://localhost:16379');
  const analyzerQueue = createAnalyzerQueue(connection);
  await analyzerQueue.obliterate({ force: true });
  const aiExplanationQueue = createAiExplanationQueue(connection);
  await aiExplanationQueue.obliterate({ force: true });

  return {
    prisma,
    storage,
    analyzerQueue,
    aiExplanationQueue,
    maxUploadBytes,
    rawLogRetentionHours: 24,
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    close: async () => {
      await analyzerQueue.close();
      await aiExplanationQueue.close();
      connection.disconnect();
    },
  };
}

async function* linesFrom(rawLines: string[]): AsyncGenerator<string> {
  for (const line of rawLines) yield line;
}

/**
 * Creates a Project + Analysis and advances it to `analyzer_result_ready`
 * with a real ObservationSet (via the real `analyzeAccessLog()` pipeline
 * against the `valid.log` fixture + `persistAnalyzerSuccess`), rather than a
 * hand-rolled ObservationSet that could drift from the real shape — the same
 * "prefer real production code paths" precedent as
 * `apps/worker/src/__tests__/worker-test-helpers.ts`'s
 * `setUpAnalysisReadyForAiExplanation`.
 */
export async function createAnalysisReadyForAiExplanation(deps: { prisma: ApiDeps['prisma'] }): Promise<{
  analysisId: string;
}> {
  const project = await new PrismaProjectRepository(deps.prisma).create({ name: `AI Explanation API Test ${Date.now()}` });
  const analysisRepository = new PrismaAnalysisRepository(deps.prisma);
  const analysis = await analysisRepository.create({ projectId: project.id });
  await analysisRepository.updateStatus(analysis.id, 'uploaded');
  await analysisRepository.updateStatus(analysis.id, 'analyzing');

  const rawLines = readFixture('valid.log').split('\n').filter((line) => line.length > 0);
  const result = await analyzeAccessLog(linesFrom(rawLines));
  if (result.analyzerStatus === 'failed') {
    throw new Error(`createAnalysisReadyForAiExplanation: analyzer returned failed (${result.errorCode})`);
  }
  await persistAnalyzerSuccess(deps.prisma, {
    analysisId: analysis.id,
    analyzerStatus: result.analyzerStatus,
    observationSet: result.observationSet,
  });

  return { analysisId: analysis.id };
}

/**
 * Hand-builds a multipart/form-data body — no extra dependency needed just
 * for a handful of upload tests.
 */
export function buildMultipartUpload(params: {
  fieldName: string;
  filename: string;
  content: string | Buffer;
  contentType?: string;
}): { body: Buffer; contentType: string } {
  const boundary = `----PolarisTestBoundary${Date.now()}`;
  const contentType = params.contentType ?? 'text/plain';
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${params.fieldName}"; filename="${params.filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const bodyContent = Buffer.isBuffer(params.content) ? params.content : Buffer.from(params.content);
  return {
    body: Buffer.concat([head, bodyContent, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}
