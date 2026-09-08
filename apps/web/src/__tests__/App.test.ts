import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { ref } from 'vue';
import App from '../App.vue';
import { router } from '../router/index.js';
import { isAuthLoaded, isSignedIn } from '../auth/auth-state.js';
import * as projectsApi from '../api/projects';

const mockIsLoaded = ref(false);
const mockIsSignedIn = ref<boolean | undefined>(undefined);
const mockGetToken = vi.fn().mockResolvedValue('a-token');

vi.mock('@clerk/vue', () => ({
  useAuth: () => ({ isLoaded: mockIsLoaded, isSignedIn: mockIsSignedIn, getToken: ref(mockGetToken) }),
  useUser: () => ({ user: ref(null) }),
  SignIn: { name: 'SignInStub', template: '<div data-testid="sign-in-stub" />' },
  SignUp: { name: 'SignUpStub', template: '<div data-testid="sign-up-stub" />' },
}));

/**
 * F-07 (`50_Development_Setup_and_Seventh_Sprint.md` decision 11): App.vue
 * is what actually closes the "Initial Navigation" race —
 * router.beforeEach resolves the very first navigation before App.vue's
 * own watcher ever fires, while auth state still holds its initial
 * defaults, so it only ever defers. These tests drive that watcher
 * directly by flipping the mocked Clerk `isLoaded`/`isSignedIn` refs after
 * mount, exactly mirroring what a real Clerk load does asynchronously.
 */
describe('App.vue auth gating (T-AUTH-13a/13b)', () => {
  let wrapper: VueWrapper | undefined;

  beforeEach(() => {
    mockIsLoaded.value = false;
    mockIsSignedIn.value = undefined;
    isAuthLoaded.value = false;
    isSignedIn.value = false;
    mockGetToken.mockClear();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('T-AUTH-13a: a signed-in user opening a Protected URL directly renders it without a premature Sign-In redirect', async () => {
    const listProjects = vi.spyOn(projectsApi, 'listProjects').mockResolvedValue([]);
    await router.push('/projects');
    await router.isReady();

    wrapper = mount(App, { global: { plugins: [router] } });

    // Still loading — the Protected page never rendered, and the router
    // never bounced to Sign In while auth state was still unknown.
    expect(wrapper.text()).toContain('読み込んでいます');
    expect(router.currentRoute.value.name).toBe('project-list');

    mockIsLoaded.value = true;
    mockIsSignedIn.value = true;
    await vi.waitFor(() => expect(isAuthLoaded.value).toBe(true));
    await vi.waitFor(() => expect(listProjects).toHaveBeenCalled());

    // Never redirected to sign-in at any point in this flow.
    expect(router.currentRoute.value.name).toBe('project-list');
  });

  it('T-AUTH-13b: a signed-out user opening a Protected URL directly lands on Sign In and never fires the page\'s data-fetch', async () => {
    const listProjects = vi.spyOn(projectsApi, 'listProjects');
    await router.push('/projects');
    await router.isReady();

    wrapper = mount(App, { global: { plugins: [router] } });

    mockIsLoaded.value = true;
    mockIsSignedIn.value = false;
    await vi.waitFor(() => expect(isAuthLoaded.value).toBe(true));

    expect(router.currentRoute.value.name).toBe('sign-in');
    expect(listProjects).not.toHaveBeenCalled();
  });

  it('T-AUTH-16a (55_Sprint_7_Independent_Review.md M-01): a reactive Clerk sign-out on an already-mounted Protected page redirects to Sign In', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValue([]);
    await router.push('/projects');
    await router.isReady();

    wrapper = mount(App, { global: { plugins: [router] } });

    // Reach the normal signed-in, fully-loaded steady state first.
    mockIsLoaded.value = true;
    mockIsSignedIn.value = true;
    await vi.waitFor(() => expect(isAuthLoaded.value).toBe(true));
    expect(router.currentRoute.value.name).toBe('project-list');

    // Session revoked/expired elsewhere (another tab, server-side) — Clerk
    // itself flips isSignedIn without any new Navigation ever happening.
    mockIsSignedIn.value = false;
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('sign-in'));
  });
});
