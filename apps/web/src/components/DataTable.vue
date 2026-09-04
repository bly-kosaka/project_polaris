<script setup lang="ts" generic="T extends object">
export interface DataTableColumn<T> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  value?: (row: T) => string | number;
}

const props = defineProps<{
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}>();

const emit = defineEmits<{ rowClick: [row: T] }>();

function cellText(column: DataTableColumn<T>, row: T): string | number {
  if (column.value) return column.value(row);
  const v = (row as Record<string, unknown>)[column.key];
  return typeof v === 'string' || typeof v === 'number' ? v : '';
}
</script>

<template>
  <div class="data-table__scroll">
    <table class="data-table">
      <thead>
        <tr>
          <th
            v-for="column in props.columns"
            :key="column.key"
            :class="{ 'data-table__cell--right': column.align === 'right' }"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in props.rows"
          :key="props.rowKey(row)"
          class="data-table__row"
          tabindex="0"
          @click="emit('rowClick', row)"
          @keydown.enter="emit('rowClick', row)"
        >
          <td
            v-for="column in props.columns"
            :key="column.key"
            :class="{ 'data-table__cell--right': column.align === 'right' }"
          >
            <slot :name="`cell-${column.key}`" :row="row">{{ cellText(column, row) }}</slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.data-table__scroll {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.data-table th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 2px solid var(--color-border);
  color: var(--color-text-muted);
  font-weight: 600;
  white-space: nowrap;
}

.data-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  vertical-align: top;
}

.data-table__cell--right {
  text-align: right;
}

.data-table__row {
  cursor: pointer;
}

.data-table__row:hover,
.data-table__row:focus-visible {
  background: var(--color-bg);
  outline: none;
}
</style>
