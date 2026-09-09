import { createRouter, createWebHistory } from 'vue-router';
import { isAuthLoaded, isSignedIn } from '../auth/auth-state.js';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
  }
}

/**
 * Route param values are never trusted as the Source of Truth for
 * Business State — every page fetches Project/Analysis state from the API
 * itself (39_Development_Setup_and_Fifth_Sprint.md §10).
 */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/projects' },
    {
      path: '/projects',
      name: 'project-list',
      component: () => import('../pages/ProjectListPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/projects/new',
      name: 'project-create',
      component: () => import('../pages/ProjectCreatePage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/projects/:projectId',
      name: 'project-overview',
      component: () => import('../pages/ProjectOverviewPage.vue'),
      props: true,
      meta: { requiresAuth: true },
    },
    {
      path: '/projects/:projectId/analyses/new',
      name: 'analysis-upload',
      component: () => import('../pages/AnalysisUploadPage.vue'),
      props: true,
      meta: { requiresAuth: true },
    },
    {
      path: '/analyses/:analysisId/processing',
      name: 'analysis-processing',
      component: () => import('../pages/AnalysisProcessingPage.vue'),
      props: true,
      meta: { requiresAuth: true },
    },
    {
      path: '/analyses/:analysisId',
      name: 'analysis-result',
      component: () => import('../pages/AnalysisResultPage.vue'),
      props: true,
      meta: { requiresAuth: true },
    },
    {
      path: '/billing',
      name: 'billing',
      component: () => import('../pages/BillingPage.vue'),
      meta: { requiresAuth: true },
    },
    { path: '/sign-in', name: 'sign-in', component: () => import('../pages/SignInPage.vue') },
    { path: '/sign-up', name: 'sign-up', component: () => import('../pages/SignUpPage.vue') },
    {
      path: '/account',
      name: 'account-settings',
      component: () => import('../pages/AccountSettingsPage.vue'),
      meta: { requiresAuth: true },
    },
  ],
});

/**
 * F-07 (`50_Development_Setup_and_Seventh_Sprint.md` decision 11): this
 * guard only ever DEFERS while auth state is unknown — it never redirects
 * on `isAuthLoaded`'s initial `false` default. Judging a Protected URL
 * against that default would wrongly bounce an already-signed-in user who
 * opened it directly, before Clerk ever got a chance to say otherwise.
 * `App.vue`'s own post-load re-check (once `isLoaded` flips true) is what
 * actually makes that decision for the Initial Navigation. For every
 * subsequent in-app navigation (once `isAuthLoaded` is already true),
 * this guard alone is the real, sufficient check.
 */
router.beforeEach((to) => {
  if (!to.meta.requiresAuth) return true;
  if (!isAuthLoaded.value) return true;
  if (!isSignedIn.value) return { name: 'sign-in', query: { redirect: to.fullPath } };
  return true;
});
