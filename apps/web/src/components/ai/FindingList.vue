<script setup lang="ts">
import FindingCard from './FindingCard.vue';
import type { AIFindingDto } from '../../api/ai-explanation-schema';

/**
 * Renders AI's returned order exactly — never re-sorted by any local
 * heuristic (10_Output_Presentation.md, md/44 §74). A Finding count of 0 is
 * an explicit, allowed AI outcome, with md/44 §21's exact copy — never
 * "異常なし"/"問題なし"/"安全"/"攻撃なし".
 */
defineProps<{ findings: AIFindingDto[] }>();
const emit = defineEmits<{ 'navigate-reference': [groupId: string] }>();
</script>

<template>
  <section class="finding-list">
    <h2 class="finding-list__heading">Findings</h2>
    <p v-if="findings.length === 0" class="finding-list__empty">
      選出された観測情報から、
      <br />
      優先して説明するFindingは生成されませんでした。
    </p>
    <div v-else class="finding-list__items">
      <FindingCard
        v-for="finding in findings"
        :key="finding.id"
        :finding="finding"
        @navigate-reference="(groupId) => emit('navigate-reference', groupId)"
      />
    </div>
  </section>
</template>

<style scoped>
.finding-list {
  margin-bottom: var(--space-4);
}

.finding-list__heading {
  font-size: var(--font-size-lg);
  font-weight: 700;
  margin-bottom: var(--space-3);
}

.finding-list__empty {
  color: var(--color-text-muted);
}

.finding-list__items {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
</style>
