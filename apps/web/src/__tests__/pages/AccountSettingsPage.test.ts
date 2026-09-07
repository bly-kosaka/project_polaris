import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import { ref } from 'vue';
import AccountSettingsPage from '../../pages/AccountSettingsPage.vue';

const mockSignOut = vi.fn().mockResolvedValue(undefined);
const mockUser = ref<{ primaryEmailAddress: { emailAddress: string; verification: { status: string } } } | null>(
  null,
);

vi.mock('@clerk/vue', () => ({
  useAuth: () => ({ signOut: ref(mockSignOut) }),
  useUser: () => ({ user: mockUser }),
}));

async function mountPage() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: AccountSettingsPage },
      { path: '/sign-in', name: 'sign-in', component: { template: '<div />' } },
    ],
  });
  router.push('/');
  await router.isReady();
  return { wrapper: mount(AccountSettingsPage, { global: { plugins: [router] } }), router };
}

describe('AccountSettingsPage', () => {
  it('shows the primary email and unverified state when not verified', async () => {
    mockUser.value = { primaryEmailAddress: { emailAddress: 'user@example.com', verification: { status: 'unverified' } } };
    const { wrapper } = await mountPage();
    expect(wrapper.text()).toContain('user@example.com');
    expect(wrapper.text()).toContain('未確認');
  });

  it('shows the verified badge when the primary email is verified', async () => {
    mockUser.value = { primaryEmailAddress: { emailAddress: 'user@example.com', verification: { status: 'verified' } } };
    const { wrapper } = await mountPage();
    expect(wrapper.text()).toContain('確認済み');
  });

  it('signs out and redirects to sign-in on the sign-out control', async () => {
    mockUser.value = { primaryEmailAddress: { emailAddress: 'user@example.com', verification: { status: 'verified' } } };
    const { wrapper, router } = await mountPage();

    await wrapper.find('.account-settings-page__sign-out').trigger('click');
    await vi.waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('sign-in'));
  });
});
