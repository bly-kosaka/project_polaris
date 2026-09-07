import { z } from 'zod';

/**
 * Only infra actually used by Sprint 1 (DB / Redis / Storage) is required.
 * AI / Auth / Billing keys stay optional here since those integrations are
 * explicitly out of scope for this sprint (26_Development_Setup_and_First_Sprint.md #78)
 * and requiring them would block local dev for unrelated future features.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_BASE_URL: z.string().url(),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  S3_ENDPOINT: z.string().min(1),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  // Pre-benchmark placeholders (34_Development_Setup_and_Fourth_Sprint.md
  // §21/§43) — both a real limit and a real retention window are required,
  // never left unbounded, but the exact numbers are expected to be tuned later.
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(52428800),
  RAW_LOG_RETENTION_HOURS: z.coerce.number().int().positive().default(24),

  // Never '*' (39_Development_Setup_and_Fifth_Sprint.md §16) — apps/api's
  // buildServer() reads this from ApiDeps, never process.env directly
  // (40_Sprint_5_Plan_Review.md F-04).
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),

  // AI Explanation (44_Development_Setup_and_Sixth_Sprint.md §118). Sprint 6
  // only supports 'openai'; OPENAI_API_KEY/OPENAI_MODEL stay optional at the
  // schema level (functionally required only once AI is actually invoked —
  // CI's Fake Provider tests never need a real key, 46_Sprint_6_Plan_Final_Review.md).
  AI_PROVIDER: z.enum(['openai']).default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  OPENAI_REASONING_EFFORT: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(90000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(4096),
  AI_MAX_INPUT_BYTES: z.coerce.number().int().positive().default(200000),
  AI_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),

  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
