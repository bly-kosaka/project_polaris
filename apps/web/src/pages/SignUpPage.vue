<script setup lang="ts">
import { SignUp } from '@clerk/vue';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

// Never hand-rolled — wraps Clerk's own prebuilt component
// (50_Development_Setup_and_Seventh_Sprint.md §3).

const route = useRoute();
// See SignInPage.vue's comment (55_Sprint_7_Independent_Review.md m-01).
const redirectTarget = computed(() => {
  const value = route.query.redirect;
  return typeof value === 'string' ? value : null;
});
</script>

<template>
  <div class="sign-up-page">
    <!-- routing="virtual" (default) — see SignInPage.vue's comment. -->
    <SignUp sign-in-url="/sign-in" :fallback-redirect-url="redirectTarget" />
  </div>
</template>

<style scoped>
.sign-up-page {
  display: flex;
  justify-content: center;
  padding: var(--space-6) var(--space-4);
}
</style>
