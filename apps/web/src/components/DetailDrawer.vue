<script setup lang="ts">
import { ref, watch } from 'vue';

/**
 * Escape closes the Drawer and focus returns to the row that opened it
 * (39_Development_Setup_and_Fifth_Sprint.md §57/A-22).
 */
const props = defineProps<{ modelValue: boolean; title: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const panelRef = ref<HTMLElement | null>(null);
let lastFocused: HTMLElement | null = null;

function close() {
  emit('update:modelValue', false);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close();
}

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      lastFocused = document.activeElement as HTMLElement | null;
      window.addEventListener('keydown', onKeydown);
      await new Promise((resolve) => setTimeout(resolve, 0));
      panelRef.value?.focus();
    } else {
      window.removeEventListener('keydown', onKeydown);
      lastFocused?.focus();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div v-if="modelValue" class="detail-drawer">
    <div class="detail-drawer__backdrop" @click="close" />
    <div
      ref="panelRef"
      class="detail-drawer__panel"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      tabindex="-1"
    >
      <div class="detail-drawer__header">
        <h2 class="detail-drawer__title">{{ title }}</h2>
        <button type="button" class="detail-drawer__close" aria-label="閉じる" @click="close">×</button>
      </div>
      <div class="detail-drawer__body">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-drawer {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

.detail-drawer__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(16, 25, 54, 0.4);
}

.detail-drawer__panel {
  position: relative;
  width: min(var(--layout-drawer-width), 100%);
  height: 100%;
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  outline: none;
}

.detail-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.detail-drawer__title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  margin: 0;
}

.detail-drawer__close {
  appearance: none;
  background: none;
  border: none;
  font-size: var(--font-size-xl);
  line-height: 1;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: var(--space-1) var(--space-2);
}

.detail-drawer__close:hover {
  color: var(--color-text);
}

.detail-drawer__body {
  padding: var(--space-4);
  overflow-y: auto;
}
</style>
