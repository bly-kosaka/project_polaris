<script setup lang="ts">
import { SignIn } from '@clerk/vue';

// Never hand-rolled — wraps Clerk's own prebuilt component
// (50_Development_Setup_and_Seventh_Sprint.md §3).
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
    <SignIn sign-up-url="/sign-up" />
  </div>
</template>

<style scoped>
.sign-in-page {
  display: flex;
  justify-content: center;
  padding: var(--space-6) var(--space-4);
}
</style>
