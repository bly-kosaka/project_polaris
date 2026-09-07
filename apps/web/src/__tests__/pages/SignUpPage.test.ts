import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SignUpPage from '../../pages/SignUpPage.vue';

vi.mock('@clerk/vue', () => ({
  SignUp: { name: 'SignUpStub', props: ['routing', 'path', 'signInUrl'], template: '<div data-testid="sign-up-stub" />' },
}));

describe('SignUpPage', () => {
  it('renders the Clerk SignUp component — never a hand-rolled form', () => {
    const wrapper = mount(SignUpPage);
    expect(wrapper.find('[data-testid="sign-up-stub"]').exists()).toBe(true);
    expect(wrapper.find('form').exists()).toBe(false);
  });
});
