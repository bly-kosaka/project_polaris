import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AIStatusPanel from '../../../components/ai/AIStatusPanel.vue';

describe('AIStatusPanel', () => {
  it('shows a loading indicator for queued, never claiming the analysis itself failed', () => {
    const wrapper = mount(AIStatusPanel, { props: { aiStatus: 'queued' } });
    expect(wrapper.text()).toContain('生成しています');
    expect(wrapper.text()).not.toMatch(/失敗|問題(は)?ありません|安全です/);
  });

  it('shows a loading indicator for running', () => {
    const wrapper = mount(AIStatusPanel, { props: { aiStatus: 'running' } });
    expect(wrapper.text()).toContain('AIによる説明を生成しています');
  });

  it('failed state uses md/44 §68\'s exact copy — never "解析全体が失敗" — and offers Retry', async () => {
    const wrapper = mount(AIStatusPanel, { props: { aiStatus: 'failed' } });
    expect(wrapper.text()).toContain('AIによる説明を生成できませんでした');
    expect(wrapper.text()).toContain('Analyzerによる集計結果は利用できます');
    expect(wrapper.text()).not.toContain('解析全体が失敗');
    expect(wrapper.text()).not.toMatch(/問題(は)?ありません|安全です/);

    const button = wrapper.find('button');
    expect(button.exists()).toBe(true);
    await button.trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });

  it('renders nothing for not_requested/success — those states are shown elsewhere', () => {
    expect(mount(AIStatusPanel, { props: { aiStatus: 'not_requested' } }).text()).toBe('');
    expect(mount(AIStatusPanel, { props: { aiStatus: 'success' } }).text()).toBe('');
  });
});
