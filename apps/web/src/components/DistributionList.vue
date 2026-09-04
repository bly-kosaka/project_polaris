<script setup lang="ts">
import { computed } from 'vue';
import type { CountMapDto } from '../api/schemas';

/**
 * Renders a CountMap (e.g. status/method distribution) as a plain bar list —
 * proportional width only, no color-coded severity
 * (39_Development_Setup_and_Fifth_Sprint.md §9/§53).
 */
const props = defineProps<{ entries: CountMapDto }>();

const total = computed(() => props.entries.reduce((sum, entry) => sum + entry.count, 0));

function percent(count: number): number {
  if (total.value === 0) return 0;
  return Math.round((count / total.value) * 100);
}
</script>

<template>
  <ul class="distribution-list">
    <li v-for="entry in props.entries" :key="String(entry.key)" class="distribution-list__row">
      <span class="distribution-list__key">{{ entry.key }}</span>
      <span class="distribution-list__bar-track">
        <span class="distribution-list__bar" :style="{ width: `${percent(entry.count)}%` }" />
      </span>
      <span class="distribution-list__count">{{ entry.count }}</span>
    </li>
  </ul>
</template>

<style scoped>
.distribution-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.distribution-list__row {
  display: grid;
  grid-template-columns: 80px 1fr 48px;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.distribution-list__key {
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.distribution-list__bar-track {
  height: 8px;
  border-radius: 999px;
  background: var(--color-border);
  overflow: hidden;
}

.distribution-list__bar {
  display: block;
  height: 100%;
  background: var(--color-accent);
}

.distribution-list__count {
  text-align: right;
  color: var(--color-text);
}
</style>
