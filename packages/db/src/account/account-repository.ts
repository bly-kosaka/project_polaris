import type { Account } from '@polaris/domain';
import type { CreateAccountInput } from './types.js';

export interface AccountRepository {
  findByAuthSubject(authProvider: string, authSubject: string): Promise<Account | null>;
  /**
   * The sole Lazy Provisioning entry point
   * (50_Development_Setup_and_Seventh_Sprint.md §9,
   * 51_Sprint_7_Plan_Review.md F-01) — atomic and race-safe under
   * concurrent first-requests from the same Clerk subject (implemented as
   * one Prisma `upsert` keyed on `authSubject`'s `@unique` constraint,
   * never a raced find-then-create).
   */
  getOrCreateByAuthSubject(input: CreateAccountInput): Promise<Account>;
  /** Best-effort profile-snapshot refresh — never load-bearing for any authorization decision. */
  updateProfile(id: string, fields: { email?: string; emailVerified: boolean }): Promise<Account>;
}
