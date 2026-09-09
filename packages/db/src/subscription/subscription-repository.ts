import type { SubscriptionSnapshot } from '@polaris/domain';
import type { UpsertSubscriptionInput } from './types.js';

export interface SubscriptionRepository {
  findByAccountId(accountId: string): Promise<SubscriptionSnapshot | null>;
  findByProviderSubscriptionId(providerSubscriptionId: string): Promise<SubscriptionSnapshot | null>;
  /**
   * The sole write path for Subscription state — one atomic Prisma `upsert`
   * keyed on `providerSubscriptionId`'s `@unique` constraint, same
   * "atomic upsert, never find-then-write" precedent as Sprint 7's
   * `AccountRepository.getOrCreateByAuthSubject`. Called only from the
   * Stripe Webhook route, with the canonical state re-fetched from Stripe
   * itself (57_Development_Setup_and_Eighth_Sprint.md §26) — never with a
   * webhook payload's own fields trusted verbatim.
   */
  upsertByProviderSubscriptionId(input: UpsertSubscriptionInput): Promise<SubscriptionSnapshot>;
}
