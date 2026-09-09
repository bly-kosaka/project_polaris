<script setup lang="ts">
import NoticePanel from './NoticePanel.vue';

/**
 * Shown when a Retry attempt comes back with `ENTITLEMENT_REQUIRED` (403).
 * `ErrorState.vue` has no action-button slot to extend for a "Pro案内" CTA
 * (57_Development_Setup_and_Eighth_Sprint.md plan decision 8), so this is a
 * small, dedicated component instead.
 */
</script>

<template>
  <NoticePanel title="Pro機能" variant="info" class="entitlement-required-notice">
    <p class="entitlement-required-notice__message">
      AI Explanationの再試行はPro機能です。
      <br />
      Analyzerによる集計結果は引き続き利用できます。
    </p>
    <RouterLink to="/billing" class="entitlement-required-notice__link">Proプランについて見る</RouterLink>
  </NoticePanel>
</template>

<style scoped>
.entitlement-required-notice__message {
  margin: 0 0 var(--space-3);
}

.entitlement-required-notice__link {
  display: inline-flex;
  align-items: center;
  padding: var(--space-2) var(--space-4);
  background: var(--color-base);
  color: var(--color-text-inverse);
  border-radius: var(--radius-md);
  text-decoration: none;
  font-weight: 600;
}
</style>
