<script setup lang="ts">
/**
 * `0` results — distinct from UnavailableState (a dimension the current
 * input can't produce at all). Never phrased as "no problem"/"safe"
 * (39_Development_Setup_and_Fifth_Sprint.md §18/§47).
 */
withDefaults(defineProps<{ message?: string }>(), {
  message: 'この集計軸では表示できるデータがありません。',
});
</script>

<template>
  <div class="empty-state" role="status">
    <p>{{ message }}</p>
  </div>
</template>

<style scoped>
.empty-state {
  padding: var(--space-6) var(--space-4);
  text-align: center;
  color: var(--color-text-muted);
}
</style>
