import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import SignUpPage from '../../pages/SignUpPage.vue';

vi.mock('@clerk/vue', () => ({
  SignUp: {
    name: 'SignUpStub',
    props: ['signInUrl', 'fallbackRedirectUrl'],
    template: '<div data-testid="sign-up-stub" />',
  },
}));

async function mountPage(initialPath = '/sign-up') {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: '/sign-up', name: 'sign-up', component: SignUpPage }],
  });
  router.push(initialPath);
  await router.isReady();
  return mount(SignUpPage, { global: { plugins: [router] } });
}

describe('SignUpPage', () => {
  it('renders the Clerk SignUp component — never a hand-rolled form', async () => {
    const wrapper = await mountPage();
    expect(wrapper.find('[data-testid="sign-up-stub"]').exists()).toBe(true);
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('m-01 (55_Sprint_7_Independent_Review.md): passes the redirect query through as fallbackRedirectUrl', async () => {
    const wrapper = await mountPage('/sign-up?redirect=%2Fprojects%2Fp1');
    expect(wrapper.findComponent({ name: 'SignUpStub' }).props('fallbackRedirectUrl')).toBe('/projects/p1');
  });
});
