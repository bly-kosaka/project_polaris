<script setup lang="ts">
/**
 * "AI Summary / AIによる要約" label always attached — never presented so it
 * could be mistaken for Analyzer fact (md/44 §70).
 */
defineProps<{ summary: string }>();
</script>

<template>
  <section class="ai-summary">
    <h2 class="ai-summary__heading">AI Summary <span class="ai-summary__subheading">AIによる要約</span></h2>
    <p class="ai-summary__text">{{ summary }}</p>
  </section>
</template>

<style scoped>
.ai-summary {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  background: var(--color-surface);
}

.ai-summary__heading {
  font-size: var(--font-size-lg);
  font-weight: 700;
  margin-bottom: var(--space-2);
}

.ai-summary__subheading {
  font-size: var(--font-size-sm);
  font-weight: 400;
  color: var(--color-text-muted);
}

.ai-summary__text {
  margin: 0;
  color: var(--color-text);
  white-space: pre-wrap;
}
</style>
