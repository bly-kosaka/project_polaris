<script setup lang="ts">
import { computed } from 'vue';
import StatusBadge from '../StatusBadge.vue';
import { urgencyLevelLabel } from '../../utils/statusLabels';
import type { AIUrgencyAssessmentDto } from '../../api/ai-explanation-schema';

/**
 * md/44 §69 — always label + icon + reason together, never color alone
 * (§109), and never a bare "危険度：高"-style single word. `unavailable`
 * covers the AI-failure case explicitly, rather than silently omitting this
 * section or falling back to a score computed from Analyzer counts
 * (10_Output_Presentation.md).
 */
const props = defineProps<{
  urgency: AIUrgencyAssessmentDto | null;
  unavailable?: boolean;
}>();
const emit = defineEmits<{ 'navigate-reference': [groupId: string] }>();

const ICONS: Record<AIUrgencyAssessmentDto['level'], string> = {
  low: '○',
  normal: '◇',
  high: '▲',
  immediate: '■',
};

const label = computed(() => (props.urgency ? urgencyLevelLabel(props.urgency.level) : null));
const icon = computed(() => (props.urgency ? ICONS[props.urgency.level] : null));
</script>

<template>
  <section v-if="unavailable || urgency" class="overall-urgency-card">
    <h2 class="overall-urgency-card__heading">AIによる確認優先度</h2>

    <p v-if="unavailable || !urgency" class="overall-urgency-card__unavailable">確認優先度は利用できません。</p>
    <template v-else>
      <div class="overall-urgency-card__level">
        <span class="overall-urgency-card__icon" aria-hidden="true">{{ icon }}</span>
        <StatusBadge v-bind="label!" />
      </div>
      <p class="overall-urgency-card__reason">{{ urgency.reason }}</p>
      <ul v-if="urgency.limitations.length > 0" class="overall-urgency-card__limitations">
        <li v-for="(limitation, index) in urgency.limitations" :key="index">{{ limitation }}</li>
      </ul>
      <div v-if="urgency.references.length > 0" class="overall-urgency-card__references">
        <button
          v-for="ref in urgency.references"
          :key="ref.groupId"
          type="button"
          class="overall-urgency-card__reference"
          @click="emit('navigate-reference', ref.groupId)"
        >
          関連データを見る
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.overall-urgency-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  background: var(--color-surface);
}

.overall-urgency-card__heading {
  font-size: var(--font-size-lg);
  font-weight: 700;
  margin-bottom: var(--space-2);
}

.overall-urgency-card__unavailable {
  margin: 0;
  color: var(--color-text-muted);
}

.overall-urgency-card__level {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.overall-urgency-card__icon {
  font-size: var(--font-size-lg);
}

.overall-urgency-card__reason {
  margin: 0 0 var(--space-2);
  color: var(--color-text);
}

.overall-urgency-card__limitations {
  margin: 0 0 var(--space-2);
  padding-left: var(--space-4);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.overall-urgency-card__references {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.overall-urgency-card__reference {
  appearance: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-info);
  cursor: pointer;
}

.overall-urgency-card__reference:hover {
  background: var(--color-info-bg);
}
</style>
