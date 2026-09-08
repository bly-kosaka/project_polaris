<script setup lang="ts">
import { SignUp } from '@clerk/vue';

// Never hand-rolled — wraps Clerk's own prebuilt component
// (50_Development_Setup_and_Seventh_Sprint.md §3).
</script>

<template>
  <div class="sign-up-page">
    <!-- routing="virtual" (default) — see SignInPage.vue's comment. -->
    <SignUp sign-in-url="/sign-in" />
  </div>
</template>

<style scoped>
.sign-up-page {
  display: flex;
  justify-content: center;
  padding: var(--space-6) var(--space-4);
}
</style>
