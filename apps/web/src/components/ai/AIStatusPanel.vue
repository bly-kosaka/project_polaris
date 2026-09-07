<script setup lang="ts">
import LoadingState from '../LoadingState.vue';
import NoticePanel from '../NoticePanel.vue';
import type { AIStatus } from '../../types/dto';

/**
 * queued/running -> a loading indicator that never hides
 * Result Overview/Data Limitation/Aggregation (md/44 §67 — those stay
 * operable). failed -> md/44 §68's exact copy, which never says the
 * analysis itself failed, plus a Retry button. not_requested/success render
 * nothing here — success is shown via OverallUrgencyCard/AISummary/FindingList.
 */
defineProps<{ aiStatus: AIStatus }>();
const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <LoadingState v-if="aiStatus === 'queued' || aiStatus === 'running'" message="AIによる説明を生成しています" />
  <NoticePanel v-else-if="aiStatus === 'failed'" title="AI説明" variant="warning">
    <p class="ai-status-panel__message">
      AIによる説明を生成できませんでした。
      <br />
      Analyzerによる集計結果は利用できます。
      <br />
      必要に応じて再試行してください。
    </p>
    <button type="button" class="ai-status-panel__retry" @click="emit('retry')">再試行</button>
  </NoticePanel>
</template>

<style scoped>
.ai-status-panel__message {
  margin: 0 0 var(--space-3);
}

.ai-status-panel__retry {
  appearance: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  padding: var(--space-2) var(--space-4);
  font: inherit;
  cursor: pointer;
}

.ai-status-panel__retry:hover {
  background: var(--color-warning-bg);
}
</style>
