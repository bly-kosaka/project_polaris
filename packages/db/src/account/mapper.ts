import type { Account } from '@polaris/domain';
import type { Account as PrismaAccount } from '../generated/prisma/client.js';

export function toDomainAccount(record: PrismaAccount): Account {
  return {
    id: record.id,
    // Sprint 7 only ever writes 'clerk' into this column (Clerk-only scope,
    // m-04 in 52_Sprint_7_Plan_Final_Review.md) — a plain String column
    // rather than a Prisma enum, since a real second Provider isn't planned yet.
    authProvider: record.authProvider as Account['authProvider'],
    authSubject: record.authSubject,
    ...(record.email !== null ? { email: record.email } : {}),
    emailVerified: record.emailVerified,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
