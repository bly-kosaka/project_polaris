import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import BillingPage from '../../pages/BillingPage.vue';
import * as billingApi from '../../api/billing';
import { ApiError } from '../../api/client';
import type { BillingSummaryDto } from '../../api/billing-schema';

function freeSummary(): BillingSummaryDto {
  return {
    plan: 'free',
    subscription: { status: null, cancelAtPeriodEnd: false },
    features: { aiExplanationRetry: false },
    canManageBilling: false,
  };
}

function proSummary(): BillingSummaryDto {
  return {
    plan: 'pro',
    subscription: { status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: '2026-02-01T00:00:00Z' },
    features: { aiExplanationRetry: true },
    canManageBilling: true,
  };
}

async function mountPage(initialPath = '/billing') {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: '/billing', name: 'billing', component: BillingPage }],
  });
  router.push(initialPath);
  await router.isReady();
  return mount(BillingPage, { global: { plugins: [router] } });
}

describe('BillingPage', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, href: '' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: originalLocation });
  });

  it('T-WEB-BILL-01: shows the Free plan card and an Upgrade button, but no Manage Billing button', async () => {
    vi.spyOn(billingApi, 'getBillingSummary').mockResolvedValue(freeSummary());
    const wrapper = await mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('Free');
    expect(wrapper.text()).toContain('基本解析 + 初回AI Explanation');
    expect(wrapper.text()).toContain('再確認・継続調査のための追加機能');
    expect(wrapper.find('.billing-page__upgrade').exists()).toBe(true);
    expect(wrapper.find('.billing-page__manage').exists()).toBe(false);
    wrapper.unmount();
  });

  it('T-WEB-BILL-02: shows Pro plan details and a Manage Billing button, but no Upgrade button', async () => {
    vi.spyOn(billingApi, 'getBillingSummary').mockResolvedValue(proSummary());
    const wrapper = await mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('Pro');
    expect(wrapper.text()).toContain('active');
    expect(wrapper.text()).toContain('2026-02-01T00:00:00Z');
    expect(wrapper.find('.billing-page__manage').exists()).toBe(true);
    expect(wrapper.find('.billing-page__upgrade').exists()).toBe(false);
    wrapper.unmount();
  });

  it('T-WEB-BILL-04: clicking Upgrade calls startCheckout and redirects to the returned URL, never sets Pro locally', async () => {
    vi.spyOn(billingApi, 'getBillingSummary').mockResolvedValue(freeSummary());
    const startCheckout = vi
      .spyOn(billingApi, 'startCheckout')
      .mockResolvedValue({ url: 'https://fake-checkout.test/session' });

    const wrapper = await mountPage();
    await flushPromises();

    await wrapper.find('.billing-page__upgrade').trigger('click');
    await flushPromises();

    expect(startCheckout).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe('https://fake-checkout.test/session');
    // The plan shown is still whatever the last GET /billing said — a
    // Checkout call alone never flips it locally (§7/§36).
    expect(wrapper.text()).toContain('Free');
    wrapper.unmount();
  });

  it('T-WEB-BILL-05: ?checkout=success shows a banner and refetches once, without trusting the query param as proof of Pro', async () => {
    const getBillingSummary = vi.spyOn(billingApi, 'getBillingSummary').mockResolvedValue(freeSummary());

    const wrapper = await mountPage('/billing?checkout=success');
    await flushPromises();

    expect(getBillingSummary).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('お手続きありがとうございます');
    // Still Free — the banner alone never grants Pro locally.
    expect(wrapper.text()).toContain('Free');
    wrapper.unmount();
  });

  it('clicking Manage Billing calls openBillingPortal and redirects to the returned URL', async () => {
    vi.spyOn(billingApi, 'getBillingSummary').mockResolvedValue(proSummary());
    const openBillingPortal = vi
      .spyOn(billingApi, 'openBillingPortal')
      .mockResolvedValue({ url: 'https://fake-portal.test/session' });

    const wrapper = await mountPage();
    await flushPromises();

    await wrapper.find('.billing-page__manage').trigger('click');
    await flushPromises();

    expect(openBillingPortal).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe('https://fake-portal.test/session');
    wrapper.unmount();
  });

  it('renders ErrorState when the initial GET /billing fails', async () => {
    vi.spyOn(billingApi, 'getBillingSummary').mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'boom'));
    const wrapper = await mountPage();
    await flushPromises();

    expect(wrapper.find('.error-state').exists()).toBe(true);
    wrapper.unmount();
  });

  it('clicking 更新 refetches the Billing Summary', async () => {
    const getBillingSummary = vi.spyOn(billingApi, 'getBillingSummary').mockResolvedValue(freeSummary());
    const wrapper = await mountPage();
    await flushPromises();
    expect(getBillingSummary).toHaveBeenCalledTimes(1);

    await wrapper.find('.billing-page__refresh').trigger('click');
    await flushPromises();
    expect(getBillingSummary).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });
});
