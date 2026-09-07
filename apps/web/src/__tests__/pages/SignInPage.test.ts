import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SignInPage from '../../pages/SignInPage.vue';

vi.mock('@clerk/vue', () => ({
  SignIn: { name: 'SignInStub', props: ['routing', 'path', 'signUpUrl'], template: '<div data-testid="sign-in-stub" />' },
}));

describe('SignInPage', () => {
  it('renders the Clerk SignIn component — never a hand-rolled form', () => {
    const wrapper = mount(SignInPage);
    expect(wrapper.find('[data-testid="sign-in-stub"]').exists()).toBe(true);
    expect(wrapper.find('form').exists()).toBe(false);
  });
});
