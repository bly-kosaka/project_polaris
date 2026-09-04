<script setup lang="ts">
import { computed } from 'vue';
import DataTable, { type DataTableColumn } from '../DataTable.vue';
import EmptyState from '../EmptyState.vue';
import type { UserAgentAggregationDto, SelectedGroup } from '../../api/schemas';

type Row = SelectedGroup<UserAgentAggregationDto>;

const props = defineProps<{ groups: Row[] }>();
const emit = defineEmits<{ rowClick: [row: Row] }>();

const MAX_INLINE_LENGTH = 60;

function truncated(userAgent: string): string {
  return userAgent.length > MAX_INLINE_LENGTH ? `${userAgent.slice(0, MAX_INLINE_LENGTH)}…` : userAgent;
}

const columns: DataTableColumn<Row>[] = [
  { key: 'userAgent', label: 'User-Agent' },
  { key: 'requestCount', label: 'Requests', align: 'right', value: (r) => r.value.requestCount },
  { key: 'distinctPathCount', label: 'Distinct Path', align: 'right', value: (r) => r.value.distinctPathCount },
  { key: 'distinctSourceIpCount', label: 'Distinct Source IP', align: 'right', value: (r) => r.value.distinctSourceIpCount },
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
    <template #cell-userAgent="{ row }">
      <span :title="row.value.userAgent">{{ truncated(row.value.userAgent) }}</span>
    </template>
  </DataTable>
</template>
