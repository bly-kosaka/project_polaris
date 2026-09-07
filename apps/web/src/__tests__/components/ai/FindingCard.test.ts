import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import FindingCard from '../../../components/ai/FindingCard.vue';

function finding(overrides: Partial<{ interpretation: string; limitation: string }> = {}) {
  return {
    id: 'finding-1',
    title: 'ログインパスへの集中アクセス',
    observation: '/wp-login.php への同一IPからのリクエストが観測されました。',
    interpretation: overrides.interpretation ?? '総当たり的なログイン試行の可能性があります。',
    limitation: overrides.limitation ?? 'このログだけでは成否は判断できません。',
    nextChecks: ['認証ログを確認する'],
    references: [{ groupId: 'path:abc123' }],
  };
}

describe('FindingCard', () => {
  it('renders fact (確認できたこと) and speculation (考えられること) as visually distinct sections', () => {
    const wrapper = mount(FindingCard, { props: { finding: finding() } });
    expect(wrapper.text()).toContain('確認できたこと');
    expect(wrapper.text()).toContain('考えられること');
    expect(wrapper.text()).toContain('このログだけでは分からないこと');
    expect(wrapper.text()).toContain('次に確認すること');

    const interpretationSection = wrapper.find('.finding-card__section--interpretation');
    expect(interpretationSection.exists()).toBe(true);
    expect(interpretationSection.text()).toContain('総当たり的なログイン試行の可能性があります。');
  });

  it('never shows Severity/Priority/Finding-level Urgency', () => {
    const wrapper = mount(FindingCard, { props: { finding: finding() } });
    expect(wrapper.text()).not.toMatch(/Severity|Priority|優先度|危険度/);
  });

  it('omits the interpretation/limitation sections when absent', () => {
    const f = finding();
    delete (f as { interpretation?: string }).interpretation;
    delete (f as { limitation?: string }).limitation;
    const wrapper = mount(FindingCard, { props: { finding: f } });
    expect(wrapper.find('.finding-card__section--interpretation').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('考えられること');
  });

  it('emits navigate-reference for the evidence link', async () => {
    const wrapper = mount(FindingCard, { props: { finding: finding() } });
    await wrapper.find('.finding-card__reference').trigger('click');
    expect(wrapper.emitted('navigate-reference')).toEqual([['path:abc123']]);
  });
});
