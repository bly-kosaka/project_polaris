<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import PageHeader from '../components/PageHeader.vue';
import LoadingState from '../components/LoadingState.vue';
import ErrorState from '../components/ErrorState.vue';
import EmptyState from '../components/EmptyState.vue';
import StatusBadge from '../components/StatusBadge.vue';
import DataTable, { type DataTableColumn } from '../components/DataTable.vue';
import { getProject, listProjectAnalyses } from '../api/projects';
import { analysisStatusLabel } from '../utils/statusLabels';
import type { AnalysisSummaryDto, ProjectDetailDto } from '../types/dto';

const props = defineProps<{ projectId: string }>();
const router = useRouter();

const project = ref<ProjectDetailDto | null>(null);
const analyses = ref<AnalysisSummaryDto[] | null>(null);
const error = ref<unknown>(null);
const isLoading = ref(true);

async function load(): Promise<void> {
  isLoading.value = true;
  error.value = null;
  try {
    const [projectResult, analysesResult] = await Promise.all([
      getProject(props.projectId),
      listProjectAnalyses(props.projectId),
    ]);
    project.value = projectResult;
    analyses.value = analysesResult;
  } catch (err) {
    error.value = err;
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => void load());

const PROCESSING_STATUSES = new Set(['created', 'uploaded', 'analyzing']);

function openAnalysis(analysis: AnalysisSummaryDto): void {
  if (PROCESSING_STATUSES.has(analysis.status)) {
    void router.push(`/analyses/${analysis.id}/processing`);
  } else {
    void router.push(`/analyses/${analysis.id}`);
  }
}

const columns = computed<DataTableColumn<AnalysisSummaryDto>[]>(() => [
  { key: 'originalFileName', label: 'ファイル名', value: (row) => row.originalFileName ?? '—' },
  { key: 'status', label: 'ステータス' },
  { key: 'requestCount', label: 'リクエスト数', align: 'right', value: (row) => row.requestCount ?? '—' },
  { key: 'createdAt', label: '作成日時', value: (row) => row.createdAt },
]);
</script>

<template>
  <LoadingState v-if="isLoading" message="Projectを読み込んでいます…" />
  <ErrorState v-else-if="error" :error="error" />
  <template v-else-if="project">
    <PageHeader :title="project.name">
      <template #actions>
        <RouterLink :to="`/projects/${props.projectId}/analyses/new`" class="project-overview-page__upload-link">
          新規Analysis作成
        </RouterLink>
      </template>
    </PageHeader>

    <EmptyState v-if="analyses && analyses.length === 0" message="まだAnalysisがありません。" />
    <!-- @vue-generic {AnalysisSummaryDto} -->
    <DataTable
      v-else-if="analyses"
      :columns="columns"
      :rows="analyses"
      :row-key="(row: AnalysisSummaryDto) => row.id"
      @row-click="openAnalysis"
    >
      <template #cell-status="{ row }">
        <StatusBadge v-bind="analysisStatusLabel(row.status)" />
      </template>
    </DataTable>
  </template>
</template>

<style scoped>
.project-overview-page__upload-link {
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
