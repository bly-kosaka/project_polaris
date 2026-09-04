<script setup lang="ts">
export interface TabNavItem {
  key: string;
  label: string;
}

const props = defineProps<{
  tabs: TabNavItem[];
  modelValue: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [key: string] }>();

function select(key: string) {
  emit('update:modelValue', key);
}

function onKeydown(event: KeyboardEvent, index: number) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
  event.preventDefault();
  const delta = event.key === 'ArrowRight' ? 1 : -1;
  const nextIndex = (index + delta + props.tabs.length) % props.tabs.length;
  const next = props.tabs[nextIndex];
  if (next) select(next.key);
}
</script>

<template>
  <div class="tab-nav" role="tablist">
    <button
      v-for="(tab, index) in props.tabs"
      :key="tab.key"
      type="button"
      role="tab"
      class="tab-nav__tab"
      :class="{ 'tab-nav__tab--active': tab.key === props.modelValue }"
      :aria-selected="tab.key === props.modelValue"
      :tabindex="tab.key === props.modelValue ? 0 : -1"
      @click="select(tab.key)"
      @keydown="onKeydown($event, index)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<style scoped>
.tab-nav {
  display: flex;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
}

.tab-nav__tab {
  appearance: none;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: var(--space-3) var(--space-3);
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  white-space: nowrap;
}

.tab-nav__tab:hover {
  color: var(--color-text);
}

.tab-nav__tab--active {
  color: var(--color-base);
  border-bottom-color: var(--color-accent);
}

.tab-nav__tab:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
}
</style>
