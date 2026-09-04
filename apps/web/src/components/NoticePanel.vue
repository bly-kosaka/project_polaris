<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    variant?: 'info' | 'warning' | 'danger';
  }>(),
  { variant: 'info' },
);
</script>

<template>
  <section class="notice-panel" :class="`notice-panel--${variant}`">
    <h2 class="notice-panel__title">{{ title }}</h2>
    <div class="notice-panel__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.notice-panel {
  border: 1px solid var(--color-border);
  border-left-width: 4px;
  border-radius: var(--radius-md);
  padding: var(--space-4);
  background: var(--color-surface);
  margin-bottom: var(--space-4);
}

.notice-panel--info {
  border-left-color: var(--color-info);
}
.notice-panel--warning {
  border-left-color: var(--color-warning);
}
.notice-panel--danger {
  border-left-color: var(--color-danger);
}

.notice-panel__title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  margin-bottom: var(--space-2);
}

.notice-panel__body {
  color: var(--color-text);
}
</style>
