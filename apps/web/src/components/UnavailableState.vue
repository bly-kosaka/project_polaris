<script setup lang="ts">
/**
 * Reserved for a dimension the current input structurally cannot produce
 * (e.g. no lines were parsed at all) — distinct from EmptyState's "0
 * results from a valid run" (39_Development_Setup_and_Fifth_Sprint.md §48,
 * decision 10 in the Sprint 5 plan).
 */
withDefaults(defineProps<{ message?: string }>(), {
  message: 'このログ形式ではこの情報を利用できません。',
});
</script>

<template>
  <div class="unavailable-state" role="status">
    <p>{{ message }}</p>
  </div>
</template>

<style scoped>
.unavailable-state {
  padding: var(--space-6) var(--space-4);
  text-align: center;
  color: var(--color-text-muted);
  font-style: italic;
}
</style>
