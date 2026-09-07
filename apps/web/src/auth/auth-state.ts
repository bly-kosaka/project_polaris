import { ref } from 'vue';

/**
 * Plain, non-composable refs any file can safely read — including
 * `router/index.ts`'s `beforeEach`, which must never call `useAuth()`
 * itself (F-05/F-07,
 * `50_Development_Setup_and_Seventh_Sprint.md` decision 11). `App.vue` is
 * the ONLY place these are written to; `useAuth()` is called exactly once,
 * there.
 */
export const isAuthLoaded = ref(false);
export const isSignedIn = ref(false);
