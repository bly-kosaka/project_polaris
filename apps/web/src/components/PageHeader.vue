<script setup lang="ts">
withDefaults(defineProps<{ title: string; subtitle?: string }>(), {});
</script>

<template>
  <div class="page-header">
    <h1 class="page-header__title">{{ title }}</h1>
    <p v-if="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
}

.page-header__title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
}

.page-header__subtitle {
  color: var(--color-text-muted);
  margin-top: var(--space-1);
}

.page-header__actions {
  display: flex;
  gap: var(--space-2);
}
</style>
