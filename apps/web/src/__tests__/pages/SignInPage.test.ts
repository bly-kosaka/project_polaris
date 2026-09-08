import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import SignInPage from '../../pages/SignInPage.vue';

vi.mock('@clerk/vue', () => ({
  SignIn: {
    name: 'SignInStub',
    props: ['signUpUrl', 'fallbackRedirectUrl'],
    template: '<div data-testid="sign-in-stub" />',
  },
}));

async function mountPage(initialPath = '/sign-in') {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: '/sign-in', name: 'sign-in', component: SignInPage }],
  });
  router.push(initialPath);
  await router.isReady();
  return mount(SignInPage, { global: { plugins: [router] } });
}

describe('SignInPage', () => {
  it('renders the Clerk SignIn component — never a hand-rolled form', async () => {
    const wrapper = await mountPage();
    expect(wrapper.find('[data-testid="sign-in-stub"]').exists()).toBe(true);
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('m-01 (55_Sprint_7_Independent_Review.md): passes the redirect query through as fallbackRedirectUrl', async () => {
    const wrapper = await mountPage('/sign-in?redirect=%2Fprojects%2Fp1');
    expect(wrapper.findComponent({ name: 'SignInStub' }).props('fallbackRedirectUrl')).toBe('/projects/p1');
  });

  it('passes null when there is no redirect query', async () => {
    const wrapper = await mountPage();
    expect(wrapper.findComponent({ name: 'SignInStub' }).props('fallbackRedirectUrl')).toBeNull();
  });
});
