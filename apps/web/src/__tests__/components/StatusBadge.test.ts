import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import StatusBadge from '../../components/StatusBadge.vue';

describe('StatusBadge', () => {
  it('renders the label text, never only a color', () => {
    const wrapper = mount(StatusBadge, { props: { label: '完了', variant: 'success' } });
    expect(wrapper.text()).toBe('完了');
    expect(wrapper.classes()).toContain('status-badge--success');
  });

  it('defaults to the neutral variant', () => {
    const wrapper = mount(StatusBadge, { props: { label: '未処理' } });
    expect(wrapper.classes()).toContain('status-badge--neutral');
  });
});
