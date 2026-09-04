<script setup lang="ts">
import { computed } from 'vue';
import DataTable, { type DataTableColumn } from '../DataTable.vue';
import DistributionList from '../DistributionList.vue';
import KnownInformationBadge from '../KnownInformationBadge.vue';
import EmptyState from '../EmptyState.vue';
import type { PathAggregationDto, SelectedGroup } from '../../api/schemas';

type Row = SelectedGroup<PathAggregationDto>;

const props = defineProps<{ groups: Row[] }>();
const emit = defineEmits<{ rowClick: [row: Row] }>();

const columns: DataTableColumn<Row>[] = [
  { key: 'path', label: 'Path', value: (r) => r.value.path },
  { key: 'requestCount', label: 'Requests', align: 'right', value: (r) => r.value.requestCount },
  { key: 'distinctSourceIpCount', label: 'Distinct Source IP', align: 'right', value: (r) => r.value.distinctSourceIpCount },
  { key: 'distinctUserAgentCount', label: 'Distinct UA', align: 'right', value: (r) => r.value.distinctUserAgentCount },
  { key: 'methodDistribution', label: 'Method' },
  { key: 'statusDistribution', label: 'Status' },
  { key: 'knownInformation', label: 'Known Information' },
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
    <template #cell-methodDistribution="{ row }">
      <DistributionList :entries="row.value.methodDistribution" />
    </template>
    <template #cell-statusDistribution="{ row }">
      <DistributionList :entries="row.value.statusDistribution" />
    </template>
    <template #cell-knownInformation="{ row }">
      <div class="path-table__badges">
        <KnownInformationBadge v-for="match in row.value.knownInformation" :key="match.id" :match="match" />
      </div>
    </template>
  </DataTable>
</template>

<style scoped>
.path-table__badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
</style>
