import type { UsageEvent } from '@polaris/domain';
import type { CreateUsageEventInput } from './types.js';

/**
 * `create()` only in Sprint 8 (m-02, `58_Sprint_8_Plan_Review.md`) — no
 * counting/query method. The Usage counting period (Calendar Month /
 * Subscription Period / Rolling 30 Days) is undecided, and Sprint 8 does no
 * Quota enforcement at all; a query shape would be a guess. Revisit when a
 * real Usage/Quota Sprint needs one.
 */
export interface UsageEventRepository {
  create(input: CreateUsageEventInput): Promise<UsageEvent>;
}
