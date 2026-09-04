import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { S3Client } from '@aws-sdk/client-s3';
import { prisma } from '@polaris/db';
import {
  ANALYZER_QUEUE,
  createAnalyzerQueue,
  createMaintenanceQueue,
  createProducerConnection,
  createWorkerConnection,
} from '@polaris/queue';
import type { AnalyzerJobData } from '@polaris/queue';
import { ensureBucket, S3TemporaryObjectStorage } from '@polaris/storage';
import { Worker } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '@polaris/api/server';
import type { ApiDeps } from '@polaris/api/deps';
import { handleAnalyzerJob } from '@polaris/worker/analyzer-job-handler';
import type { WorkerDeps } from '@polaris/worker/deps';
import App from '@polaris/web/src/App.vue';
import { router } from '@polaris/web/src/router/index';

/**
 * Product Integration Test (40_Sprint_5_Plan_Review.md F-05 / decision 12):
 * the only place in the repo that combines apps/api, apps/worker, and
 * apps/web's real page components in one process, against real
 * Postgres/Redis/MinIO — a Browser-equivalent Flow (happy-dom DOM
 * assertions + real network calls to a real `app.listen()` server), not
 * literal browser automation. Isolated from apps/web's own frontend-only
 * test suite on purpose, since it needs to import real backend code — done
 * via apps/api's/apps/worker's `exports` subpaths so the import never
 * triggers their bootstrap `main()` side effect.
 */
const API_PORT = 34099;
const BUCKET = 'polaris-product-e2e-tests';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const validLog = readFileSync(path.join(repoRoot, 'fixtures', 'access-logs', 'valid.log'), 'utf-8');

let apiServer: FastifyInstance;
let analyzerWorker: Worker<AnalyzerJobData>;
let teardownFns: Array<() => Promise<void>> = [];

beforeAll(async () => {
  await prisma.observationSetRecord.deleteMany();
  await prisma.analysisExecution.deleteMany();
  await prisma.uploadedAccessLog.deleteMany();
  await prisma.analysis.deleteMany();
  await prisma.projectKnownInformation.deleteMany();
  await prisma.project.deleteMany();

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

  const producerConnection = createProducerConnection(process.env.REDIS_URL ?? 'redis://localhost:16379');
  const analyzerQueue = createAnalyzerQueue(producerConnection);
  await analyzerQueue.obliterate({ force: true });

  const apiDeps: ApiDeps = {
    prisma,
    storage,
    analyzerQueue,
    maxUploadBytes: 52428800,
    rawLogRetentionHours: 24,
    // Must match vitest.config.ts's `environmentOptions.happyDOM.url` — the
    // mounted app's page origin, which real @fastify/cors checks against.
    corsOrigin: 'http://localhost:5173',
  };
  apiServer = await buildServer(apiDeps);
  await apiServer.listen({ port: API_PORT, host: '127.0.0.1' });

  const workerConnection = createWorkerConnection(process.env.REDIS_URL ?? 'redis://localhost:16379');
  const maintenanceQueue = createMaintenanceQueue(workerConnection);
  const workerDeps: WorkerDeps = { prisma, storage, maintenanceQueue };
  analyzerWorker = new Worker<AnalyzerJobData>(ANALYZER_QUEUE, (job) => handleAnalyzerJob(job, workerDeps), {
    connection: workerConnection,
    concurrency: 1,
  });
  await analyzerWorker.waitUntilReady();

  teardownFns = [
    () => apiServer.close(),
    () => analyzerWorker.close(),
    () => maintenanceQueue.close(),
    () => analyzerQueue.close(),
    async () => {
      producerConnection.disconnect();
      workerConnection.disconnect();
    },
  ];
});

afterAll(async () => {
  for (const close of teardownFns) {
    await close();
  }
  await prisma.$disconnect();
});

describe('Product flow', () => {
  it('walks Project Create -> Analysis Upload -> real Worker processing -> Result -> Drawer against the real stack', async () => {
    await router.push('/projects/new');
    await router.isReady();
    const wrapper = mount(App, { global: { plugins: [router] } });
    await flushPromises();

    // --- Project Create ---
    await wrapper.find('#project-name').setValue('Product E2E Project');
    await wrapper.find('form').trigger('submit.prevent');
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('project-overview'), { timeout: 10000 });
    await flushPromises();

    const projectId = router.currentRoute.value.params.projectId as string;
    expect(projectId).toBeTruthy();

    // --- Analysis Create + Upload ---
    await router.push(`/projects/${projectId}/analyses/new`);
    await flushPromises();

    const file = new File([validLog], 'valid.log', { type: 'text/plain' });
    const fileInputElement = wrapper.find('#access-log-file').element as HTMLInputElement;
    Object.defineProperty(fileInputElement, 'files', { value: [file], configurable: true });
    await wrapper.find('#access-log-file').trigger('change');
    await wrapper.find('form').trigger('submit.prevent');

    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('analysis-processing'), { timeout: 10000 });

    // --- real Worker processes it, Processing page polls until terminal ---
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('analysis-result'), { timeout: 30000 });
    await flushPromises();

    // --- Path Aggregation visible ---
    await vi.waitFor(() => expect(wrapper.text()).toContain('/index.html'), { timeout: 10000 });

    // --- Row Click -> Detail Drawer visible ---
    const row = wrapper.findAll('.data-table__row').find((r) => r.text().includes('/index.html'));
    expect(row).toBeTruthy();
    await row?.trigger('click');
    await flushPromises();

    expect(wrapper.find('.detail-drawer').exists()).toBe(true);
    expect(wrapper.find('.detail-drawer__title').text()).toBe('/index.html');

    wrapper.unmount();
  });
});
