<script setup lang="ts">
import { useAuth } from '@clerk/vue';
import { watch } from 'vue';
import { useRouter } from 'vue-router';
import { isAuthLoaded, isSignedIn } from './auth/auth-state.js';
import { setTokenGetter } from './api/client.js';
import AppShell from './layouts/AppShell.vue';
import LoadingState from './components/LoadingState.vue';

// useAuth() is called exactly ONCE, here — never inside router/index.ts's
// beforeEach (F-05: the architecture must not depend on whether a Clerk
// composable is safely callable outside a component's setup()).
const { isLoaded, isSignedIn: clerkSignedIn, getToken } = useAuth();
const router = useRouter();

watch(clerkSignedIn, (value) => {
  isSignedIn.value = value ?? false;
});

// F-07: closes the "Initial Navigation" race — router.beforeEach resolves
// the very first navigation before this watcher ever fires, while
// isAuthLoaded/isSignedIn still hold their initial `false` defaults, so it
// only ever defers. This is what actually decides that navigation, once
// auth state is genuinely known — re-checking the CURRENT (already
// resolved) route and redirecting BEFORE isAuthLoaded flips true, so a
// Protected page component the router would otherwise have rendered never
// mounts at all for a signed-out visitor.
watch(
  isLoaded,
  async (loaded) => {
    if (!loaded) return;
    setTokenGetter(() => getToken.value());
    isSignedIn.value = clerkSignedIn.value ?? false;

    const current = router.currentRoute.value;
    if (current.meta.requiresAuth && !isSignedIn.value) {
      await router.replace({ name: 'sign-in', query: { redirect: current.fullPath } });
    }
    isAuthLoaded.value = true;
  },
  { immediate: true },
);
</script>

<template>
  <LoadingState v-if="!isAuthLoaded" message="読み込んでいます…" />
  <AppShell v-else>
    <RouterView />
  </AppShell>
</template>
