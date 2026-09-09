import type { CreateBillingWebhookEventInput } from './types.js';

export interface BillingWebhookEventRepository {
  /**
   * Throws `DbError('CONFLICT')` (via `mapPrismaError`) on a duplicate
   * `providerEventId` — that throw itself **is** the idempotency check
   * (57_Development_Setup_and_Eighth_Sprint.md §25); callers never need a
   * separate `exists()` lookup. No domain type is returned — nothing
   * downstream ever needs to read this row back, only to know whether the
   * insert succeeded.
   */
  create(input: CreateBillingWebhookEventInput): Promise<void>;
}
