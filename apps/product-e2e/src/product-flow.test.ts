import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import { S3Client } from '@aws-sdk/client-s3';
import { PrismaAccountRepository, PrismaAnalysisRepository, PrismaProjectRepository, persistAiExplanationFailure, persistAnalyzerSuccess, prisma } from '@polaris/db';
import { analyzeAccessLog } from '@polaris/analyzer';
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

interface ProviderSubscriptionSnapshotLike {
  providerSubscriptionId: string;
  stripeCustomerId: string;
  providerPriceId?: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: string;
  providerUpdatedAt?: string;
}

/**
 * Same shape as `apps/api/src/__tests__/fake-billing-gateway.ts` — not
 * imported directly since `@polaris/api`'s `exports` only publishes `.`,
 * `./server`, `./deps` (test-only helpers are deliberately not part of the
 * package's public surface). Structurally satisfies `ApiDeps.billingGateway`
 * without needing to import the `BillingGateway` interface itself. Never a
 * shortcut to Product Entitlement (M-01) — Pro is granted, in this file,
 * exclusively via a direct `prisma.subscription.create(...)` matching
 * `createTestSubscription`'s shape.
 */
class FakeBillingGateway {
  private readonly customers = new Map<string, string>();

  async createCustomer(accountId: string): Promise<{ stripeCustomerId: string }> {
    let stripeCustomerId = this.customers.get(accountId);
    if (stripeCustomerId === undefined) {
      stripeCustomerId = `fake-cus-${accountId}`;
      this.customers.set(accountId, stripeCustomerId);
    }
    return { stripeCustomerId };
  }

  async createCheckoutSession(): Promise<{ url: string }> {
    return { url: 'https://fake-checkout.test/session' };
  }

  async createPortalSession(): Promise<{ url: string }> {
    return { url: 'https://fake-portal.test/session' };
  }

  verifyWebhookSignature(): never {
    throw new Error('FakeBillingGateway: webhook signature verification is not exercised in Product E2E');
  }

  async getSubscription(): Promise<ProviderSubscriptionSnapshotLike> {
    throw new Error('FakeBillingGateway: getSubscription is not exercised in Product E2E');
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
    billingGateway: new FakeBillingGateway(),
    maxUploadBytes: 52428800,
    rawLogRetentionHours: 24,
    // Must match vitest.config.ts's `environmentOptions.happyDOM.url` — the
    // mounted app's page origin, which real @fastify/cors checks against.
    corsOrigin: 'http://localhost:5173',
    appBaseUrl: 'http://localhost:5173',
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

async function* linesFrom(rawLines: string[]): AsyncGenerator<string> {
  for (const line of rawLines) yield line;
}

/**
 * Builds a real, fully-persisted Analysis (Account/Project/Analysis/
 * ObservationSet, via the same repository/persist functions the real API/
 * Worker use) with a terminal AI failure already in place — the exact
 * precondition the "re-試行" button on the Result page needs to appear,
 * without re-running the (already covered, above) Upload UI flow just to
 * reach it.
 */
async function createOwnedAnalysisWithFailedAiExplanation(authSubject: string): Promise<{ analysisId: string; accountId: string }> {
  const account = await new PrismaAccountRepository(prisma).getOrCreateByAuthSubject({
    authProvider: 'clerk',
    authSubject,
    email: `${authSubject}@example.com`,
    emailVerified: true,
  });
  const project = await new PrismaProjectRepository(prisma).create({
    name: `Billing Flow Project ${Date.now()}`,
    ownerAccountId: account.id,
  });
  const analysisRepository = new PrismaAnalysisRepository(prisma);
  const analysis = await analysisRepository.create({ projectId: project.id });
  await analysisRepository.updateStatus(analysis.id, 'uploaded');
  await analysisRepository.updateStatus(analysis.id, 'analyzing');

  const rawLines = validLog.split('\n').filter((line) => line.length > 0);
  const result = await analyzeAccessLog(linesFrom(rawLines));
  if (result.analyzerStatus === 'failed') {
    throw new Error(`createOwnedAnalysisWithFailedAiExplanation: analyzer returned failed (${result.errorCode})`);
  }
  await persistAnalyzerSuccess(prisma, {
    analysisId: analysis.id,
    analyzerStatus: result.analyzerStatus,
    observationSet: result.observationSet,
  });
  await persistAiExplanationFailure(prisma, { analysisId: analysis.id });

  return { analysisId: analysis.id, accountId: account.id };
}

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

  it('Sprint 8: Free -> Retry blocked -> Upgrade (Fake Subscription active) -> Pro -> Retry allowed', async () => {
    const { analysisId } = await createOwnedAnalysisWithFailedAiExplanation('billing-flow-account');
    mockToken.value = 'billing-flow-account';

    await router.push(`/analyses/${analysisId}`);
    await router.isReady();
    const wrapper = mount(App, { global: { plugins: [router] } });
    await flushPromises();

    // --- Free: Retry is blocked with the Entitlement Required notice ---
    await vi.waitFor(() => expect(wrapper.find('.ai-status-panel__retry').exists()).toBe(true), { timeout: 10000 });
    await wrapper.find('.ai-status-panel__retry').trigger('click');
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.find('.entitlement-required-notice').exists()).toBe(true), { timeout: 10000 });

    // --- Upgrade CTA navigates to Billing, which shows Free + an Upgrade button ---
    const upgradeLink = wrapper.find('.entitlement-required-notice__link');
    await upgradeLink.trigger('click');
    await flushPromises();
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('billing'), { timeout: 10000 });
    // The Upgrade button's presence is the actual current-plan signal — the
    // page's two plan-comparison cards always render both "Free" and "Pro"
    // as static copy regardless of the caller's real entitlement.
    await vi.waitFor(() => expect(wrapper.find('.billing-page__upgrade').exists()).toBe(true), { timeout: 10000 });

    // --- "Fake Subscription active" (M-01): Pro is granted the same way
    // every other test in this repo grants it — a direct Subscription row
    // write, never through FakeBillingGateway/Checkout ---
    const account = await new PrismaAccountRepository(prisma).getOrCreateByAuthSubject({
      authProvider: 'clerk',
      authSubject: 'billing-flow-account',
      email: 'billing-flow-account@example.com',
      emailVerified: true,
    });
    await prisma.subscription.create({
      data: {
        accountId: account.id,
        provider: 'stripe',
        providerSubscriptionId: `fake-sub-${account.id}`,
        status: 'active',
        cancelAtPeriodEnd: false,
      },
    });

    // --- Billing refresh reflects Pro (no Checkout ever ran, so no
    // BillingCustomer exists — canManageBilling stays false; the Upgrade
    // button disappearing is what proves the refetch actually saw Pro) ---
    await wrapper.find('.billing-page__refresh').trigger('click');
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.find('.billing-page__upgrade').exists()).toBe(false), { timeout: 10000 });

    // --- Retry allowed: back on the Result page, Retry now succeeds and
    // the real AI Worker (Fake Provider) produces a fresh AI Explanation ---
    await router.push(`/analyses/${analysisId}`);
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.find('.ai-status-panel__retry').exists()).toBe(true), { timeout: 10000 });
    await wrapper.find('.ai-status-panel__retry').trigger('click');
    await flushPromises();

    expect(wrapper.find('.entitlement-required-notice').exists()).toBe(false);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Product E2E Fake summary.'), { timeout: 30000 });

    wrapper.unmount();
  });

  it('Sprint 8: retrying another Account\'s Analysis 404s, never leaking a 403 (Ownership before Entitlement)', async () => {
    // Account A owns this Analysis and is Pro — if Entitlement were checked
    // before Ownership, a Free Account B could distinguish "not mine" (404)
    // from "not owned but Pro-only" (403) by response code alone.
    const { analysisId, accountId } = await createOwnedAnalysisWithFailedAiExplanation('retry-ownership-account-a');
    await prisma.subscription.create({
      data: {
        accountId,
        provider: 'stripe',
        providerSubscriptionId: `fake-sub-${accountId}`,
        status: 'active',
        cancelAtPeriodEnd: false,
      },
    });

    const response = await fetch(`http://127.0.0.1:${API_PORT}/analyses/${analysisId}/explanation/retry`, {
      method: 'POST',
      headers: { authorization: 'Bearer retry-ownership-account-b' },
    });
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('ANALYSIS_NOT_FOUND');
  });
});
