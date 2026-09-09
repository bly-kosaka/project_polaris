import type { UsageEvent } from '@polaris/domain';
import type { UsageEvent as PrismaUsageEvent } from '../generated/prisma/client.js';

export function toDomainUsageEvent(record: PrismaUsageEvent): UsageEvent {
  return {
    id: record.id,
    accountId: record.accountId,
    analysisId: record.analysisId,
    metric: record.metric,
    occurredAt: record.occurredAt.toISOString(),
  };
}
