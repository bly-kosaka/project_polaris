<script setup lang="ts">
import type { KnownInformationMatchDto } from '../api/schemas';

/**
 * Known Information is informational only — never rendered with the danger
 * variant, regardless of source (39_Development_Setup_and_Fifth_Sprint.md
 * §18/A-16). Always paired with its title text, never color-only.
 */
defineProps<{ match: KnownInformationMatchDto }>();
</script>

<template>
  <span class="known-information-badge" :title="match.description">
    {{ match.title }}
  </span>
</template>

<style scoped>
.known-information-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  background: var(--color-info-bg);
  color: var(--color-info);
  white-space: nowrap;
}
</style>
