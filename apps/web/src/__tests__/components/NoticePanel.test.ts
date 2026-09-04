import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import NoticePanel from '../../components/NoticePanel.vue';

describe('NoticePanel', () => {
  it('renders the title and slot content', () => {
    const wrapper = mount(NoticePanel, {
      props: { title: 'データの制限事項' },
      slots: { default: '一部の行を解析できませんでした。' },
    });
    expect(wrapper.find('.notice-panel__title').text()).toBe('データの制限事項');
    expect(wrapper.text()).toContain('一部の行を解析できませんでした。');
  });

  it('applies the warning variant class', () => {
    const wrapper = mount(NoticePanel, { props: { title: 'x', variant: 'warning' } });
    expect(wrapper.classes()).toContain('notice-panel--warning');
  });
});
