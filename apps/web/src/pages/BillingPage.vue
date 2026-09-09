<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import PageHeader from '../components/PageHeader.vue';
import LoadingState from '../components/LoadingState.vue';
import ErrorState from '../components/ErrorState.vue';
import NoticePanel from '../components/NoticePanel.vue';
import KeyValueList, { type KeyValueItem } from '../components/KeyValueList.vue';
import { getBillingSummary, openBillingPortal, startCheckout } from '../api/billing';
import type { BillingSummaryDto } from '../api/billing-schema';

const route = useRoute();

const summary = ref<BillingSummaryDto | null>(null);
const error = ref<unknown>(null);
const isLoading = ref(true);
const isActionPending = ref(false);
const actionError = ref<unknown>(null);

/**
 * `?checkout=success` is never trusted as proof of Pro
 * (57_Development_Setup_and_Eighth_Sprint.md §7/§36) — only a Stripe
 * webhook, already persisted server-side by the time this page can load,
 * ever grants it. This banner just prompts one extra GET /billing refetch;
 * the actual plan shown always comes from that response, never the query
 * param itself.
 */
const showCheckoutSuccessBanner = ref(false);

async function load(): Promise<void> {
  isLoading.value = true;
  error.value = null;
  try {
    summary.value = await getBillingSummary();
  } catch (err) {
    error.value = err;
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  showCheckoutSuccessBanner.value = route.query.checkout === 'success';
  void load();
});

async function onUpgrade(): Promise<void> {
  actionError.value = null;
  isActionPending.value = true;
  try {
    const { url } = await startCheckout();
    window.location.href = url;
  } catch (err) {
    actionError.value = err;
    isActionPending.value = false;
  }
}

async function onManageBilling(): Promise<void> {
  actionError.value = null;
  isActionPending.value = true;
  try {
    const { url } = await openBillingPortal();
    window.location.href = url;
  } catch (err) {
    actionError.value = err;
    isActionPending.value = false;
  }
}

function planItems(s: BillingSummaryDto): KeyValueItem[] {
  return [
    { key: 'plan', label: 'プラン', value: s.plan === 'pro' ? 'Pro' : 'Free' },
    { key: 'status', label: 'ステータス', value: s.subscription.status ?? '—' },
    { key: 'currentPeriodEnd', label: '次回更新日', value: s.subscription.currentPeriodEnd ?? '—' },
    { key: 'cancelAtPeriodEnd', label: '解約予定', value: s.subscription.cancelAtPeriodEnd ? 'あり' : 'なし' },
  ];
}
</script>

<template>
  <PageHeader title="Billing">
    <template #actions>
      <button type="button" class="billing-page__refresh" :disabled="isLoading" @click="load">更新</button>
    </template>
  </PageHeader>

  <NoticePanel v-if="showCheckoutSuccessBanner" title="お手続きありがとうございます" variant="info">
    <p>お支払い手続きが完了しました。反映まで少し時間がかかる場合があります。「更新」で最新のプラン状況を確認できます。</p>
  </NoticePanel>

  <LoadingState v-if="isLoading" message="Billing情報を読み込んでいます…" />
  <ErrorState v-else-if="error" :error="error" />
  <template v-else-if="summary">
    <section class="billing-page__plans">
      <article class="billing-page__plan-card">
        <h2 class="billing-page__plan-title">Free</h2>
        <p class="billing-page__plan-description">基本解析 + 初回AI Explanation</p>
      </article>
      <article class="billing-page__plan-card">
        <h2 class="billing-page__plan-title">Pro</h2>
        <p class="billing-page__plan-description">再確認・継続調査のための追加機能</p>
      </article>
    </section>

    <KeyValueList :items="planItems(summary)" class="billing-page__summary" />

    <ErrorState v-if="actionError" :error="actionError" />

    <div class="billing-page__actions">
      <button
        v-if="summary.plan === 'free'"
        type="button"
        class="billing-page__upgrade"
        :disabled="isActionPending"
        @click="onUpgrade"
      >
        Proにアップグレード
      </button>
      <button
        v-if="summary.canManageBilling"
        type="button"
        class="billing-page__manage"
        :disabled="isActionPending"
        @click="onManageBilling"
      >
        お支払い情報を管理
      </button>
    </div>
  </template>
</template>

<style scoped>
.billing-page__refresh {
  appearance: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  padding: var(--space-2) var(--space-4);
  font: inherit;
  cursor: pointer;
}

.billing-page__plans {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.billing-page__plan-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  background: var(--color-surface);
}

.billing-page__plan-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  margin-bottom: var(--space-2);
}

.billing-page__plan-description {
  color: var(--color-text-muted);
}

.billing-page__summary {
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.billing-page__actions {
  display: flex;
  gap: var(--space-3);
}

.billing-page__upgrade {
  appearance: none;
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-base);
  color: var(--color-text-inverse);
  padding: var(--space-2) var(--space-5);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.billing-page__manage {
  appearance: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  padding: var(--space-2) var(--space-5);
  font: inherit;
  cursor: pointer;
}
</style>
