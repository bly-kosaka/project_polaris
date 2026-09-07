<script setup lang="ts">
import { useUser } from '@clerk/vue';
// Fixed Header, Left Navigation, Main Content, optional Right Drawer slot
// (39_Development_Setup_and_Fifth_Sprint.md §54).

const { user } = useUser();
</script>

<template>
  <div class="app-shell">
    <header class="app-shell__header">
      <RouterLink to="/projects" class="app-shell__brand">Project Polaris</RouterLink>
      <RouterLink to="/account" class="app-shell__account">
        {{ user?.primaryEmailAddress?.emailAddress ?? 'アカウント' }}
      </RouterLink>
    </header>
    <div class="app-shell__body">
      <nav class="app-shell__nav" aria-label="メインナビゲーション">
        <RouterLink to="/projects" class="app-shell__nav-link">Projects</RouterLink>
      </nav>
      <main class="app-shell__main">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-shell__header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-5);
  background: var(--color-base);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.app-shell__account {
  color: var(--color-text-inverse);
  opacity: 0.85;
  font-size: var(--font-size-sm);
  text-decoration: none;
}

.app-shell__account:hover {
  opacity: 1;
}

.app-shell__brand {
  color: var(--color-text-inverse);
  font-weight: 700;
  font-size: var(--font-size-lg);
  text-decoration: none;
}

.app-shell__body {
  flex: 1;
  display: flex;
}

.app-shell__nav {
  width: var(--layout-nav-width);
  border-right: 1px solid var(--color-border);
  padding: var(--space-4);
  flex-shrink: 0;
}

.app-shell__nav-link {
  display: block;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  text-decoration: none;
}

.app-shell__nav-link:hover,
.app-shell__nav-link.router-link-active {
  background: var(--color-surface-raised);
  color: var(--color-info);
}

.app-shell__main {
  flex: 1;
  padding: var(--space-5);
  max-width: var(--layout-max-width);
}

@media (max-width: 767px) {
  .app-shell__body {
    flex-direction: column;
  }
  .app-shell__nav {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
    display: flex;
    padding: var(--space-2);
  }
  .app-shell__main {
    padding: var(--space-3);
  }
}
</style>
