import type { BillingCustomer } from '@polaris/domain';
import type { CreateBillingCustomerInput } from './types.js';

export interface BillingCustomerRepository {
  findByAccountId(accountId: string): Promise<BillingCustomer | null>;
  findByStripeCustomerId(stripeCustomerId: string): Promise<BillingCustomer | null>;
  create(input: CreateBillingCustomerInput): Promise<BillingCustomer>;
}
