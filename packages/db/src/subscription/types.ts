export interface UpsertSubscriptionInput {
  accountId: string;
  provider: string;
  providerSubscriptionId: string;
  providerPriceId?: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: string;
  providerUpdatedAt?: string;
}
