import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import { S3Client } from '@aws-sdk/client-s3';
import { prisma } from '@polaris/db';
import {
  AI_EXPLANATION_QUEUE,
  ANALYZER_QUEUE,
  createAiExplanationQueue,
  createAnalyzerQueue,
  createMaintenanceQueue,
  createProducerConnection,
  createWorkerConnection,
} from '@polaris/queue';
import type { AIExplanationJobData, AnalyzerJobData } from '@polaris/queue';
import { ensureBucket, S3TemporaryObjectStorage } from '@polaris/storage';
import { Worker } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '@polaris/api/server';
import type { ApiDeps } from '@polaris/api/deps';
import { handleAnalyzerJob } from '@polaris/worker/analyzer-job-handler';
import { handleAiExplanationJob } from '@polaris/worker/ai-explanation-job-handler';
import type { WorkerDeps } from '@polaris/worker/deps';
import { collectObservationGroupIds } from '@polaris/ai';
import type { AIProvider, AIProviderRequest, AIProviderResult } from '@polaris/ai';
import type { ObservationSet } from '@polaris/analyzer';
import type { AuthAdapter, AuthenticatedPrincipal } from '@polaris/auth';
import App from '@polaris/web/src/App.vue';
import { router } from '@polaris/web/src/router/index';

/**
 * The same FakeAuthAdapter identity-function convention `apps/api`'s own
 * tests use (`apps/api/src/__tests__/fake-auth-adapter.ts`) — a request
 * authenticates "as Account A" simply by sending `Bearer account-a`. Not
 * imported directly since `apps/api` doesn't publish that test helper
 * through its `exports` subpaths (it's test-only, deliberately not part of
 * the package's public surface).
 */
class FakeAuthAdapter implements AuthAdapter {
  async verifyToken(token: string): Promise<AuthenticatedPrincipal> {
    return { provider: 'clerk', subject: token, email: `${token}@example.com`, emailVerified: true };
  }
}

/**
 * Mirrors `apps/web/src/__tests__/App.test.ts`'s mocking approach —
 * `useAuth()`/`useUser()` are the only `@clerk/vue` composables `App.vue`/
 * `AppShell.vue` call, and this suite never exercises real Clerk UI (Sign
 * In/Sign Up are never visited in this flow). `mockToken` drives which
 * FakeAuthAdapter identity — and therefore which Account — a mounted
 * `App` authenticates as; switching it mid-suite (decision 13's Account
 * A -> Account B flow) is the entire mechanism for "logging in as a
 * different user" here, exactly mirroring `setTokenGetter()`'s role in
 * `apps/web/src/api/client.ts`.
 */
const mockToken = ref('account-a');
vi.mock('@clerk/vue', () => ({
  useAuth: () => ({
    isLoaded: ref(true),
    isSignedIn: ref(true),
    getToken: ref(() => Promise.resolve(mockToken.value)),
  }),
  useUser: () => ({ user: ref(null) }),
}));

/**
 * The one and only "Provider" ever invoked in this suite
 * (44_Development_Setup_and_Sixth_Sprint.md §99/§104/A6-24) — a real
 * `WorkerDeps.aiProvider` substitution (46_Sprint_6_Plan_Final_Review.md
 * F-06), never a real OpenAI call. Extracts a real `groupId` from the
 * prompt's embedded `<observation_set>` block so Grounding Validation
 * passes against the real ObservationSet the Analyzer just produced.
 */
class FakeAIProvider implements AIProvider {
  async generateExplanation(request: AIProviderRequest): Promise<AIProviderResult> {
    const match = /<observation_set>([\s\S]*)<\/observation_set>/.exec(request.prompt.userPrompt);
    const observationSet = JSON.parse(match![1]!) as ObservationSet;
    const [groupId] = collectObservationGroupIds(observationSet);

    return {
      provider: 'openai',
      model: 'fake-model',
      output: {
        summary: 'Product E2E Fake summary.',
        overallUrgency: { level: 'normal', reason: 'Product E2E fake reason.', references: [{ groupId }], limitations: [] },
        findings: [
          {
            title: 'Product E2E Fake Finding',
            observation: 'Observed via the Product E2E FakeAIProvider.',
            interpretation: null,
            limitation: null,
            nextChecks: ['Check the referenced Aggregation row.'],
            references: [{ groupId }],
          },
        ],
        overallNotes: [],
        dataLimitations: [],
      },
      providerResponseId: 'fake-response-id',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    };
  }
}

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
let aiExplanationWorker: Worker<AIExplanationJobData>;
let teardownFns: Array<() => Promise<void>> = [];

beforeAll(async () => {
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
  const aiExplanationQueue = createAiExplanationQueue(producerConnection);
  await aiExplanationQueue.obliterate({ force: true });

  const apiDeps: ApiDeps = {
    prisma,
    storage,
    analyzerQueue,
    aiExplanationQueue,
    authAdapter: new FakeAuthAdapter(),
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
  const workerDeps: WorkerDeps = {
    prisma,
    storage,
    maintenanceQueue,
    aiExplanationQueue,
    aiModelConfig: {
      provider: 'openai',
      model: 'fake-model',
      maxOutputTokens: 4096,
      timeoutMs: 90000,
      maxInputBytes: 200000,
    },
    aiProvider: new FakeAIProvider(),
  };
  analyzerWorker = new Worker<AnalyzerJobData>(ANALYZER_QUEUE, (job) => handleAnalyzerJob(job, workerDeps), {
    connection: workerConnection,
    concurrency: 1,
  });
  await analyzerWorker.waitUntilReady();

  aiExplanationWorker = new Worker<AIExplanationJobData>(
    AI_EXPLANATION_QUEUE,
    (job) => handleAiExplanationJob(job, workerDeps),
    { connection: workerConnection, concurrency: 1 },
  );
  await aiExplanationWorker.waitUntilReady();

  teardownFns = [
    () => apiServer.close(),
    () => analyzerWorker.close(),
    () => aiExplanationWorker.close(),
    () => maintenanceQueue.close(),
    () => analyzerQueue.close(),
    () => aiExplanationQueue.close(),
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
  beforeEach(() => {
    mockToken.value = 'account-a';
  });

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

    // --- AI Explanation: the real AI Worker (Fake Provider) processes the
    // job scheduleInitialAiExplanation enqueued right after Analyzer
    // success; AI Summary/Finding appear once it completes ---
    await vi.waitFor(() => expect(wrapper.text()).toContain('Product E2E Fake summary.'), { timeout: 30000 });
    expect(wrapper.text()).toContain('AIによる要約');
    expect(wrapper.text()).toContain('Product E2E Fake Finding');

    // --- Finding evidence link -> tab switch + search prefill ---
    const referenceButton = wrapper.find('.finding-card__reference');
    expect(referenceButton.exists()).toBe(true);
    await referenceButton.trigger('click');
    await flushPromises();

    const searchInput = wrapper.find('.analysis-result-page__search');
    expect((searchInput.element as HTMLInputElement).value.length).toBeGreaterThan(0);

    wrapper.unmount();
  });

  it('decision 13: Account B navigating directly to Account A\'s Project URL sees a not-found state, never the Project', async () => {
    // Account A owns this Project — created directly via the real
    // Repository/FakeAuthAdapter identity mapping (authSubject === the
    // Bearer token), the same pairing `apps/api`'s own ownership tests use.
    const { PrismaAccountRepository, PrismaProjectRepository } = await import('@polaris/db');
    const ownerAccount = await new PrismaAccountRepository(prisma).getOrCreateByAuthSubject({
      authProvider: 'clerk',
      authSubject: 'account-a',
      email: 'account-a@example.com',
      emailVerified: true,
    });
    const project = await new PrismaProjectRepository(prisma).create({
      name: 'Account A Only Project',
      ownerAccountId: ownerAccount.id,
    });

    mockToken.value = 'account-b';
    await router.push(`/projects/${project.id}`);
    await router.isReady();
    const wrapper = mount(App, { global: { plugins: [router] } });
    await flushPromises();

    await vi.waitFor(() => expect(wrapper.text()).toContain('見つかりませんでした'), { timeout: 10000 });
    expect(wrapper.text()).not.toContain('Account A Only Project');

    wrapper.unmount();
  });
});
