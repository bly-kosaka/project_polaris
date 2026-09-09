import type { BillingCustomer } from '@polaris/domain';
import type { PrismaClientLike } from '../client.js';
import { mapPrismaError } from '../errors.js';
import type { BillingCustomerRepository } from './billing-customer-repository.js';
import { toDomainBillingCustomer } from './mapper.js';
import type { CreateBillingCustomerInput } from './types.js';

export class PrismaBillingCustomerRepository implements BillingCustomerRepository {
  constructor(private readonly client: PrismaClientLike) {}

  async findByAccountId(accountId: string): Promise<BillingCustomer | null> {
    try {
      const record = await this.client.billingCustomer.findUnique({ where: { accountId } });
      return record !== null ? toDomainBillingCustomer(record) : null;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async findByStripeCustomerId(stripeCustomerId: string): Promise<BillingCustomer | null> {
    try {
      const record = await this.client.billingCustomer.findUnique({ where: { stripeCustomerId } });
      return record !== null ? toDomainBillingCustomer(record) : null;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async create(input: CreateBillingCustomerInput): Promise<BillingCustomer> {
    try {
      const record = await this.client.billingCustomer.create({
        data: { accountId: input.accountId, stripeCustomerId: input.stripeCustomerId },
      });
      return toDomainBillingCustomer(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
}
