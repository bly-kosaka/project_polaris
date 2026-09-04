<script setup lang="ts">
import { computed } from 'vue';
import DataTable, { type DataTableColumn } from '../DataTable.vue';
import EmptyState from '../EmptyState.vue';
import type { MethodAggregationDto, Group } from '../../api/schemas';

type Row = Group<MethodAggregationDto>;

const props = defineProps<{ groups: Row[] }>();
const emit = defineEmits<{ rowClick: [row: Row] }>();

const columns: DataTableColumn<Row>[] = [
  { key: 'method', label: 'Method', value: (r) => r.value.method },
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
  />
</template>
