<script setup lang="ts">
import { computed } from 'vue';
import { ApiError } from '../api/client';
import { ObservationSetParseError } from '../api/analyses';

/**
 * Distinguishes Network Error / 404 / ObservationSet-not-ready /
 * Analyzer-failed / unexpected-response cases so the message is always
 * specific (39_Development_Setup_and_Fifth_Sprint.md §50) — an unrecognized
 * error still renders a generic, non-crashing message rather than throwing.
 */
const props = defineProps<{ error: unknown }>();

interface Resolved {
  title: string;
  message: string;
}

const resolved = computed<Resolved>(() => {
  const err = props.error;

  if (err instanceof ObservationSetParseError) {
    return {
      title: '解析結果を表示できません',
      message: '解析結果のデータ形式を確認できませんでした。時間を置いて再度お試しください。',
    };
  }

  if (err instanceof ApiError) {
    if (err.code === 'NETWORK_ERROR') {
      return {
        title: 'サーバーに接続できません',
        message: 'ネットワーク接続を確認し、再度お試しください。',
      };
    }
    if (err.status === 404) {
      return {
        title: '見つかりませんでした',
        message: '指定されたProjectまたはAnalysisは存在しないか、削除された可能性があります。',
      };
    }
    if (err.code === 'OBSERVATION_SET_NOT_READY') {
      return {
        title: 'まだ解析結果がありません',
        message: 'このAnalysisの解析はまだ完了していません。',
      };
    }
    if (err.code === 'ANALYSIS_FAILED') {
      return {
        title: 'この解析は失敗しました',
        message: 'ログの解析中にエラーが発生し、結果を生成できませんでした。',
      };
    }
    return {
      title: 'エラーが発生しました',
      message: err.message || '予期しない応答を受け取りました。',
    };
  }

  return {
    title: 'エラーが発生しました',
    message: '予期しないエラーが発生しました。時間を置いて再度お試しください。',
  };
});
</script>

<template>
  <div class="error-state" role="alert">
    <p class="error-state__title">{{ resolved.title }}</p>
    <p class="error-state__message">{{ resolved.message }}</p>
  </div>
</template>

<style scoped>
.error-state {
  padding: var(--space-6) var(--space-4);
  text-align: center;
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  background: var(--color-danger-bg);
}

.error-state__title {
  font-weight: 700;
  color: var(--color-danger);
  margin-bottom: var(--space-2);
}

.error-state__message {
  color: var(--color-text);
}
</style>
