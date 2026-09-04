<script setup lang="ts">
/**
 * Pure presentational — never infers meaning itself. Color is always paired
 * with a text label, never the sole signal (39_Development_Setup_and_Fifth_Sprint.md §53).
 * Domain -> (variant, label) mapping lives in utils/statusLabels.ts, not here.
 */
withDefaults(
  defineProps<{
    label: string;
    variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  }>(),
  { variant: 'neutral' },
);
</script>

<template>
  <span class="status-badge" :class="`status-badge--${variant}`">{{ label }}</span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  white-space: nowrap;
}

.status-badge--success {
  background: var(--color-success-bg);
  color: var(--color-success);
}
.status-badge--warning {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}
.status-badge--danger {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}
.status-badge--info {
  background: var(--color-info-bg);
  color: var(--color-info);
}
.status-badge--neutral {
  background: var(--color-border);
  color: var(--color-text-muted);
}
</style>
