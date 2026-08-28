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

  OPENAI_API_KEY: z.string().optional(),
  AI_EXPLANATION_MODEL: z.string().optional(),
  AI_CHAT_MODEL: z.string().optional(),

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
