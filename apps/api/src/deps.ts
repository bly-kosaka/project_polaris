import type { AuthAdapter } from '@polaris/auth';
import type { prisma } from '@polaris/db';
import type { AIExplanationJobData, AnalyzerJobData } from '@polaris/queue';
import type { TemporaryObjectStorage } from '@polaris/storage';
import type { Queue } from 'bullmq';
import type { BillingGateway } from './billing/billing-gateway.js';

export interface ApiDeps {
  prisma: typeof prisma;
  storage: TemporaryObjectStorage;
  analyzerQueue: Queue<AnalyzerJobData>;
  aiExplanationQueue: Queue<AIExplanationJobData>;
  /**
   * Plain injected field, constructed once at bootstrap
   * (50_Development_Setup_and_Seventh_Sprint.md decision 6) — the real
   * `ClerkAuthAdapter` in production, a `FakeAuthAdapter` in tests, exactly
   * the same seam `WorkerDeps.aiProvider` already established in Sprint 6.
   */
  authAdapter: AuthAdapter;
  /**
   * Plain injected field, same DI seam as `authAdapter` — the real
   * `StripeGateway` in production, a `FakeBillingGateway` in tests
   * (57_Development_Setup_and_Eighth_Sprint.md, `apps/api/src/billing/`).
   */
  billingGateway: BillingGateway;
  maxUploadBytes: number;
  rawLogRetentionHours: number;
  /**
   * Read from env by index.ts's loadEnv() and passed in here — buildServer()
   * stays a pure, deterministic factory, never reading process.env itself
   * (40_Sprint_5_Plan_Review.md F-04).
   */
  corsOrigin: string;
  /**
   * `env.APP_BASE_URL`, threaded through for the first time — used for
   * Stripe Checkout success/cancel URLs and the Billing Portal return URL
   * (§17/§37). Already a required env var since Sprint 1; never a
   * redundant new one.
   */
  appBaseUrl: string;
}
