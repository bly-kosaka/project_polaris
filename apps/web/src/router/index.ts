import { createRouter, createWebHistory } from 'vue-router';

/**
 * Route param values are never trusted as the Source of Truth for
 * Business State — every page fetches Project/Analysis state from the API
 * itself (39_Development_Setup_and_Fifth_Sprint.md §10).
 */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/projects' },
    { path: '/projects', name: 'project-list', component: () => import('../pages/ProjectListPage.vue') },
    { path: '/projects/new', name: 'project-create', component: () => import('../pages/ProjectCreatePage.vue') },
    {
      path: '/projects/:projectId',
      name: 'project-overview',
      component: () => import('../pages/ProjectOverviewPage.vue'),
      props: true,
    },
    {
      path: '/projects/:projectId/analyses/new',
      name: 'analysis-upload',
      component: () => import('../pages/AnalysisUploadPage.vue'),
      props: true,
    },
    {
      path: '/analyses/:analysisId/processing',
      name: 'analysis-processing',
      component: () => import('../pages/AnalysisProcessingPage.vue'),
      props: true,
    },
    {
      path: '/analyses/:analysisId',
      name: 'analysis-result',
      component: () => import('../pages/AnalysisResultPage.vue'),
      props: true,
    },
  ],
});
