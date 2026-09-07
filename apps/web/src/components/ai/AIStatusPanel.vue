<script setup lang="ts">
import LoadingState from '../LoadingState.vue';
import NoticePanel from '../NoticePanel.vue';
import type { AIStatus } from '../../types/dto';

/**
 * queued/running -> a loading indicator that never hides
 * Result Overview/Data Limitation/Aggregation (md/44 §67 — those stay
 * operable). failed -> md/44 §68's exact copy, which never says the
 * analysis itself failed, plus a Retry button. not_requested/success render
 * nothing here by default — success is shown via
 * OverallUrgencyCard/AISummary/FindingList. `stuck` is the
 * 48_Sprint_6_Final_ReReview.md M-01 case: the initial AI enqueue itself
 * never happened at all (distinct from `failed`, where AI genuinely ran and
 * could not produce a result) — same Retry mechanism, different copy so it
 * doesn't misreport what happened.
 */
defineProps<{ aiStatus: AIStatus; stuck?: boolean }>();
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
  <NoticePanel v-else-if="aiStatus === 'not_requested' && stuck" title="AI説明" variant="warning">
    <p class="ai-status-panel__message">
      AIによる説明の生成を開始できませんでした。
      <br />
      Analyzerによる集計結果は利用できます。
      <br />
      再試行してください。
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
