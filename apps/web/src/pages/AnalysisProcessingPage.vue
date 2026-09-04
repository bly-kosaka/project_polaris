<script setup lang="ts">
import { watch } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '../components/PageHeader.vue';
import LoadingState from '../components/LoadingState.vue';
import ErrorState from '../components/ErrorState.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { useAnalysisPolling } from '../composables/useAnalysisPolling';
import { analysisStatusLabel } from '../utils/statusLabels';

const props = defineProps<{ analysisId: string }>();
const router = useRouter();

const { analysis, error, isPolling } = useAnalysisPolling(props.analysisId);

watch(
  () => analysis.value?.status,
  (status) => {
    if (status !== undefined && !isPolling.value) {
      void router.replace(`/analyses/${props.analysisId}`);
    }
  },
);
</script>

<template>
  <PageHeader title="解析を実行しています" />

  <ErrorState v-if="error" :error="error" />
  <template v-else>
    <div v-if="analysis" class="analysis-processing-page__status">
      <StatusBadge v-bind="analysisStatusLabel(analysis.status)" />
    </div>
    <LoadingState message="ログを解析しています…この処理には数分かかることがあります。" />
  </template>
</template>

<style scoped>
.analysis-processing-page__status {
  margin-bottom: var(--space-4);
}
</style>
