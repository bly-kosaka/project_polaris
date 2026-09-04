<script setup lang="ts">
export interface KeyValueItem {
  key: string;
  label: string;
  value: string | number;
}

defineProps<{ items: KeyValueItem[] }>();
</script>

<template>
  <dl class="key-value-list">
    <template v-for="item in items" :key="item.key">
      <dt class="key-value-list__label">{{ item.label }}</dt>
      <dd class="key-value-list__value">
        <slot :name="`value-${item.key}`" :item="item">{{ item.value }}</slot>
      </dd>
    </template>
  </dl>
</template>

<style scoped>
.key-value-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-2) var(--space-4);
  margin: 0;
}

.key-value-list__label {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.key-value-list__value {
  margin: 0;
  color: var(--color-text);
  word-break: break-word;
}
</style>
