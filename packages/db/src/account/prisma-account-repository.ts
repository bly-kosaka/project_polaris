import type { Account } from '@polaris/domain';
import type { PrismaClientLike } from '../client.js';
import { mapPrismaError } from '../errors.js';
import type { AccountRepository } from './account-repository.js';
import { toDomainAccount } from './mapper.js';
import type { CreateAccountInput } from './types.js';

export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly client: PrismaClientLike) {}

  async findByAuthSubject(authProvider: string, authSubject: string): Promise<Account | null> {
    try {
      const record = await this.client.account.findUnique({ where: { authSubject } });
      if (record === null || record.authProvider !== authProvider) return null;
      return toDomainAccount(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async getOrCreateByAuthSubject(input: CreateAccountInput): Promise<Account> {
    try {
      const record = await this.client.account.upsert({
        where: { authSubject: input.authSubject },
        create: {
          authProvider: input.authProvider,
          authSubject: input.authSubject,
          email: input.email ?? null,
          emailVerified: input.emailVerified,
        },
        // Existence-only on a race (F-01) — an already-existing row is
        // never overwritten here; opportunistic profile refresh is a
        // separate, explicit updateProfile() call.
        update: {},
      });
      return toDomainAccount(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async updateProfile(id: string, fields: { email?: string; emailVerified: boolean }): Promise<Account> {
    try {
      const record = await this.client.account.update({
        where: { id },
        data: { email: fields.email ?? null, emailVerified: fields.emailVerified },
      });
      return toDomainAccount(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
}
