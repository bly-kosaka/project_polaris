import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import EmptyState from '../../components/EmptyState.vue';
import UnavailableState from '../../components/UnavailableState.vue';

/**
 * EmptyState (0 results from a valid run) and UnavailableState (a dimension
 * this input can't produce) are deliberately distinct components with
 * distinct default copy — neither ever implies success/failure
 * (39_Development_Setup_and_Fifth_Sprint.md §47/§48).
 */
describe('EmptyState vs UnavailableState', () => {
  it('EmptyState shows its own default message', () => {
    const wrapper = mount(EmptyState);
    expect(wrapper.text()).toContain('表示できるデータがありません');
  });

  it('UnavailableState shows a distinct default message from EmptyState', () => {
    const wrapper = mount(UnavailableState);
    expect(wrapper.text()).toContain('利用できません');
    expect(wrapper.text()).not.toContain('表示できるデータがありません');
  });

  it('neither component ever renders danger/problem-free language', () => {
    const empty = mount(EmptyState);
    const unavailable = mount(UnavailableState);
    for (const text of [empty.text(), unavailable.text()]) {
      expect(text).not.toMatch(/問題(は)?ありません|安全です/);
    }
  });
});
