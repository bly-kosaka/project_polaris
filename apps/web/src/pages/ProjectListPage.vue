<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import PageHeader from '../components/PageHeader.vue';
import LoadingState from '../components/LoadingState.vue';
import ErrorState from '../components/ErrorState.vue';
import EmptyState from '../components/EmptyState.vue';
import DataTable, { type DataTableColumn } from '../components/DataTable.vue';
import { listProjects } from '../api/projects';
import type { ProjectSummaryDto } from '../types/dto';

const projects = ref<ProjectSummaryDto[] | null>(null);
const error = ref<unknown>(null);
const isLoading = ref(true);

async function load(): Promise<void> {
  isLoading.value = true;
  error.value = null;
  try {
    projects.value = await listProjects();
  } catch (err) {
    error.value = err;
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => void load());

const columns: DataTableColumn<ProjectSummaryDto>[] = [
  { key: 'name', label: 'Project名' },
  { key: 'analysisCount', label: 'Analysis数', align: 'right' },
  { key: 'latestAnalysisAt', label: '最終Analysis日時', value: (row) => row.latestAnalysisAt ?? '—' },
];
</script>

<template>
  <PageHeader title="Projects">
    <template #actions>
      <RouterLink to="/projects/new" class="project-list-page__create-link">新規Project作成</RouterLink>
    </template>
  </PageHeader>

  <LoadingState v-if="isLoading" message="Projectを読み込んでいます…" />
  <ErrorState v-else-if="error" :error="error" />
  <EmptyState v-else-if="projects && projects.length === 0" message="まだProjectがありません。" />
  <!-- @vue-generic {ProjectSummaryDto} -->
  <DataTable
    v-else-if="projects"
    :columns="columns"
    :rows="projects"
    :row-key="(row: ProjectSummaryDto) => row.id"
    @row-click="(row: ProjectSummaryDto) => $router.push(`/projects/${row.id}`)"
  />
</template>

<style scoped>
.project-list-page__create-link {
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
