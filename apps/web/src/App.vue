<script setup lang="ts">
import { useAuth } from '@clerk/vue';
import { watch } from 'vue';
import { useRouter } from 'vue-router';
import { isAuthLoaded, isSignedIn } from './auth/auth-state.js';
import { setAuthenticationFailureHandler, setTokenGetter } from './api/client.js';
import AppShell from './layouts/AppShell.vue';
import LoadingState from './components/LoadingState.vue';

// useAuth() is called exactly ONCE, here — never inside router/index.ts's
// beforeEach (F-05: the architecture must not depend on whether a Clerk
// composable is safely callable outside a component's setup()).
const { isLoaded, isSignedIn: clerkSignedIn, getToken } = useAuth();
const router = useRouter();

/**
 * Redirects AWAY from the current route to Sign In when it's Protected —
 * used both by a reactive Clerk sign-out (session expiry/revocation, or
 * signing out in another tab) and by a Backend-reported 401 on an
 * already-mounted page (55_Sprint_7_Independent_Review.md M-01). Neither
 * case is covered by router.beforeEach alone, since that guard only fires
 * on the NEXT Navigation — a page already mounted stays mounted otherwise.
 */
async function redirectToSignInIfProtected(): Promise<void> {
  const current = router.currentRoute.value;
  if (current.meta.requiresAuth) {
    await router.replace({ name: 'sign-in', query: { redirect: current.fullPath } });
  }
}

setAuthenticationFailureHandler(() => redirectToSignInIfProtected());

watch(clerkSignedIn, async (value) => {
  const nowSignedIn = value ?? false;
  isSignedIn.value = nowSignedIn;

  // Only a REACTIVE sign-out (auth state already resolved once, now
  // flipping to signed-out) needs to force a redirect here — the initial
  // load's own transition is handled entirely by the isLoaded watcher
  // below (F-07), and re-deciding it here too would race it.
  if (isAuthLoaded.value && !nowSignedIn) {
    await redirectToSignInIfProtected();
  }
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

    if (!isSignedIn.value) {
      await redirectToSignInIfProtected();
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
