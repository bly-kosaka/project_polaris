<script setup lang="ts">
import NoticePanel from '../NoticePanel.vue';

/**
 * A distinct, smaller panel from the existing DataLimitationPanel.vue (which
 * covers Analyzer-side parse/truncation/redaction/exclusion) — no dedup
 * between the two (md/44 §77). Hidden entirely when the AI returned no
 * limitations.
 */
defineProps<{ dataLimitations: string[] }>();
</script>

<template>
  <NoticePanel v-if="dataLimitations.length > 0" title="AI説明の制限事項" variant="info">
    <ul class="ai-data-limitations__list">
      <li v-for="(item, index) in dataLimitations" :key="index">{{ item }}</li>
    </ul>
  </NoticePanel>
</template>

<style scoped>
.ai-data-limitations__list {
  margin: 0;
  padding-left: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
</style>
