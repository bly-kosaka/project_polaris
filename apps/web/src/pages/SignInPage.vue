<script setup lang="ts">
import { SignIn } from '@clerk/vue';

// Never hand-rolled — wraps Clerk's own prebuilt component
// (50_Development_Setup_and_Seventh_Sprint.md §3).
</script>

<template>
  <div class="sign-in-page">
    <SignIn routing="path" path="/sign-in" sign-up-url="/sign-up" />
  </div>
</template>

<style scoped>
.sign-in-page {
  display: flex;
  justify-content: center;
  padding: var(--space-6) var(--space-4);
}
</style>
