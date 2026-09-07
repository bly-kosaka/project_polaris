<script setup lang="ts">
import type { AIFindingDto } from '../../api/ai-explanation-schema';

/**
 * md/44 §71 — fact (観測できたこと/確認できたこと) and speculation
 * (考えられること) are visually distinct sections, never merged into one
 * paragraph, so a reader can't mistake AI interpretation for Analyzer
 * observation. No Severity/Priority/Finding-level Urgency anywhere here —
 * only `overallUrgency` exists at the explanation level (§15).
 */
defineProps<{ finding: AIFindingDto }>();
const emit = defineEmits<{ 'navigate-reference': [groupId: string] }>();
</script>

<template>
  <article class="finding-card">
    <h3 class="finding-card__title">{{ finding.title }}</h3>

    <section class="finding-card__section">
      <h4 class="finding-card__label">確認できたこと</h4>
      <p class="finding-card__text">{{ finding.observation }}</p>
    </section>

    <section v-if="finding.interpretation" class="finding-card__section finding-card__section--interpretation">
      <h4 class="finding-card__label">考えられること</h4>
      <p class="finding-card__text">{{ finding.interpretation }}</p>
    </section>

    <section v-if="finding.limitation" class="finding-card__section">
      <h4 class="finding-card__label">このログだけでは分からないこと</h4>
      <p class="finding-card__text">{{ finding.limitation }}</p>
    </section>

    <section v-if="finding.nextChecks.length > 0" class="finding-card__section">
      <h4 class="finding-card__label">次に確認すること</h4>
      <ul class="finding-card__next-checks">
        <li v-for="(check, index) in finding.nextChecks" :key="index">{{ check }}</li>
      </ul>
    </section>

    <div v-if="finding.references.length > 0" class="finding-card__references">
      <button
        v-for="ref in finding.references"
        :key="ref.groupId"
        type="button"
        class="finding-card__reference"
        @click="emit('navigate-reference', ref.groupId)"
      >
        関連データを見る
      </button>
    </div>
  </article>
</template>

<style scoped>
.finding-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  background: var(--color-surface);
}

.finding-card__title {
  font-size: var(--font-size-base);
  font-weight: 700;
  margin-bottom: var(--space-3);
}

.finding-card__section {
  margin-bottom: var(--space-3);
}

.finding-card__section--interpretation {
  padding-left: var(--space-3);
  border-left: 3px solid var(--color-accent);
}

.finding-card__label {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-text-muted);
  margin-bottom: var(--space-1);
}

.finding-card__text {
  margin: 0;
  color: var(--color-text);
  white-space: pre-wrap;
}

.finding-card__next-checks {
  margin: 0;
  padding-left: var(--space-4);
  color: var(--color-text);
}

.finding-card__references {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.finding-card__reference {
  appearance: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-info);
  cursor: pointer;
}

.finding-card__reference:hover {
  background: var(--color-info-bg);
}
</style>
