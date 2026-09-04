<script setup lang="ts">
withDefaults(defineProps<{ message?: string }>(), {
  message: '読み込んでいます…',
});
</script>

<template>
  <div class="loading-state" role="status" aria-live="polite">
    <span class="loading-state__spinner" aria-hidden="true" />
    <p>{{ message }}</p>
  </div>
</template>

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-4);
  color: var(--color-text-muted);
}

.loading-state__spinner {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  animation: loading-state-spin 0.8s linear infinite;
}

@keyframes loading-state-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
