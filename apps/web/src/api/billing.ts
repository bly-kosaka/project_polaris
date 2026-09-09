import { apiFetch } from './client';
import { billingSummarySchema, type BillingSummaryDto } from './billing-schema';

export class BillingSummaryParseError extends Error {
  constructor(cause: unknown) {
    super('The Billing Summary response did not match the expected shape');
    this.name = 'BillingSummaryParseError';
    this.cause = cause;
  }
}

export async function getBillingSummary(): Promise<BillingSummaryDto> {
  const raw = await apiFetch<unknown>('/billing');
  const result = billingSummarySchema.safeParse(raw);
  if (!result.success) {
    throw new BillingSummaryParseError(result.error);
  }
  return result.data;
}

export async function startCheckout(): Promise<{ url: string }> {
  return apiFetch<{ url: string }>('/billing/checkout', { method: 'POST' });
}

export async function openBillingPortal(): Promise<{ url: string }> {
  return apiFetch<{ url: string }>('/billing/portal', { method: 'POST' });
}
