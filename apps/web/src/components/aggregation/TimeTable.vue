<script setup lang="ts">
import { computed, ref } from 'vue';
import DataTable, { type DataTableColumn } from '../DataTable.vue';
import DistributionList from '../DistributionList.vue';
import EmptyState from '../EmptyState.vue';
import type { TimeBucketAggregationDto, Group } from '../../api/schemas';

type Row = Group<TimeBucketAggregationDto>;

const props = defineProps<{ oneMinute: Row[]; fiveMinute: Row[] }>();
const emit = defineEmits<{ rowClick: [row: Row] }>();

const granularity = ref<'1m' | '5m'>('1m');

const activeGroups = computed(() => (granularity.value === '1m' ? props.oneMinute : props.fiveMinute));

const columns: DataTableColumn<Row>[] = [
  { key: 'bucketStart', label: 'Time', value: (r) => r.value.bucketStart },
  { key: 'requestCount', label: 'Requests', align: 'right', value: (r) => r.value.requestCount },
  { key: 'distinctSourceIpCount', label: 'Distinct Source IP', align: 'right', value: (r) => r.value.distinctSourceIpCount },
  { key: 'distinctPathCount', label: 'Distinct Path', align: 'right', value: (r) => r.value.distinctPathCount },
  { key: 'statusDistribution', label: 'Status' },
];

const sortedGroups = computed(() =>
  [...activeGroups.value].sort((a, b) => a.value.bucketStart.localeCompare(b.value.bucketStart)),
);
</script>

<template>
  <div class="time-table">
    <div class="time-table__toggle" role="group" aria-label="集計間隔">
      <button
        type="button"
        class="time-table__toggle-button"
        :class="{ 'time-table__toggle-button--active': granularity === '1m' }"
        @click="granularity = '1m'"
      >
        1分
      </button>
      <button
        type="button"
        class="time-table__toggle-button"
        :class="{ 'time-table__toggle-button--active': granularity === '5m' }"
        @click="granularity = '5m'"
      >
        5分
      </button>
    </div>
    <EmptyState v-if="sortedGroups.length === 0" />
    <!-- @vue-generic {Row} -->
    <DataTable
      v-else
      :columns="columns"
      :rows="sortedGroups"
      :row-key="(r: Row) => r.groupId"
      @row-click="emit('rowClick', $event)"
    >
      <template #cell-statusDistribution="{ row }">
        <DistributionList :entries="row.value.statusDistribution" />
      </template>
    </DataTable>
  </div>
</template>

<style scoped>
.time-table__toggle {
  display: inline-flex;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 2px;
}

.time-table__toggle-button {
  appearance: none;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
}

.time-table__toggle-button--active {
  background: var(--color-accent);
  color: var(--color-base);
}
</style>
