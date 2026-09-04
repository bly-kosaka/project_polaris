<script setup lang="ts">
import { computed } from 'vue';
import DataTable, { type DataTableColumn } from '../DataTable.vue';
import EmptyState from '../EmptyState.vue';
import type { SourceIpAggregationDto, SelectedGroup } from '../../api/schemas';

type Row = SelectedGroup<SourceIpAggregationDto>;

const props = defineProps<{ groups: Row[] }>();
const emit = defineEmits<{ rowClick: [row: Row] }>();

/**
 * 4xx/5xx counts are a Presentation-layer re-grouping of the existing
 * statusDistribution CountMap for readability — not a new Risk judgment
 * (40_Sprint_5_Plan_Review.md §9).
 */
function count4xx(row: Row): number {
  return row.value.statusDistribution
    .filter((entry) => Number(entry.key) >= 400 && Number(entry.key) < 500)
    .reduce((sum, entry) => sum + entry.count, 0);
}
function count5xx(row: Row): number {
  return row.value.statusDistribution
    .filter((entry) => Number(entry.key) >= 500 && Number(entry.key) < 600)
    .reduce((sum, entry) => sum + entry.count, 0);
}

const columns: DataTableColumn<Row>[] = [
  { key: 'sourceIp', label: 'Source IP', value: (r) => r.value.sourceIp },
  { key: 'requestCount', label: 'Requests', align: 'right', value: (r) => r.value.requestCount },
  { key: 'distinctPathCount', label: 'Distinct Path', align: 'right', value: (r) => r.value.distinctPathCount },
  { key: 'distinctUserAgentCount', label: 'Distinct UA', align: 'right', value: (r) => r.value.distinctUserAgentCount },
  { key: 'status4xx', label: '4xx', align: 'right', value: (r) => count4xx(r) },
  { key: 'status5xx', label: '5xx', align: 'right', value: (r) => count5xx(r) },
  { key: 'topPaths', label: 'Top Paths' },
];

const sortedGroups = computed(() => [...props.groups].sort((a, b) => b.value.requestCount - a.value.requestCount));
</script>

<template>
  <EmptyState v-if="groups.length === 0" />
  <!-- @vue-generic {Row} -->
  <DataTable
    v-else
    :columns="columns"
    :rows="sortedGroups"
    :row-key="(r: Row) => r.groupId"
    @row-click="emit('rowClick', $event)"
  >
    <template #cell-topPaths="{ row }">
      <span class="source-ip-table__top-paths">{{ row.value.topPaths.map((p: { value: string }) => p.value).join(', ') }}</span>
    </template>
  </DataTable>
</template>

<style scoped>
.source-ip-table__top-paths {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
