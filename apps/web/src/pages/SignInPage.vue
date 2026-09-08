<script setup lang="ts">
import { SignIn } from '@clerk/vue';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

// Never hand-rolled — wraps Clerk's own prebuilt component
// (50_Development_Setup_and_Seventh_Sprint.md §3).

const route = useRoute();
// router/index.ts's beforeEach guard and App.vue's own redirect both set
// this query param to the originally-requested Protected URL — passed
// through as a fallback (not forced) redirect so Clerk's own post-sign-in
// behavior (e.g. an Organization-selection step) still takes priority when
// applicable (55_Sprint_7_Independent_Review.md m-01).
const redirectTarget = computed(() => {
  const value = route.query.redirect;
  return typeof value === 'string' ? value : null;
});
</script>

<template>
  <div class="sign-in-page">
    <!--
      routing="virtual" (the default when routing/path are both omitted) —
      Clerk manages every multi-step sub-state (e.g. email verification)
      internally without ever pushing a browser URL like
      "/sign-in/factor-one". routing="path" instead expects the host router
      to have a matching route for every such sub-path, which Vue Router
      does not here, and silently breaks mid-flow (missing e.g. the email
      verification code screen) — this was a live bug during Sprint 7's
      manual Clerk smoke test, not just a theoretical concern.
    -->
    <SignIn sign-up-url="/sign-up" :fallback-redirect-url="redirectTarget" />
  </div>
</template>

<style scoped>
.sign-in-page {
  display: flex;
  justify-content: center;
  padding: var(--space-6) var(--space-4);
}
</style>
