import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import OverallUrgencyCard from '../../../components/ai/OverallUrgencyCard.vue';

function urgency(overrides: Partial<{ level: 'low' | 'normal' | 'high' | 'immediate'; reason: string }> = {}) {
  return {
    level: overrides.level ?? 'high',
    reason: overrides.reason ?? '短時間に多数のリクエストが観測されました。',
    references: [{ groupId: 'path:abc123' }],
    limitations: [],
  };
}

describe('OverallUrgencyCard', () => {
  it('always pairs the label with an icon and the reason text, never color alone', () => {
    const wrapper = mount(OverallUrgencyCard, { props: { urgency: urgency({ level: 'high' }) } });
    expect(wrapper.text()).toContain('早めの確認を推奨');
    expect(wrapper.text()).toContain('短時間に多数のリクエストが観測されました。');
    expect(wrapper.find('.overall-urgency-card__icon').exists()).toBe(true);
    expect(wrapper.find('.overall-urgency-card__icon').text().length).toBeGreaterThan(0);
  });

  it('never shows a bare "危険度：高"-style label', () => {
    const wrapper = mount(OverallUrgencyCard, { props: { urgency: urgency({ level: 'immediate' }) } });
    expect(wrapper.text()).not.toContain('危険度');
  });

  it('shows an explicit unavailable state on AI failure, never a fabricated score', () => {
    const wrapper = mount(OverallUrgencyCard, { props: { urgency: null, unavailable: true } });
    expect(wrapper.text()).toContain('利用できません');
    expect(wrapper.find('.overall-urgency-card__icon').exists()).toBe(false);
  });

  it('emits navigate-reference when an evidence link is clicked', async () => {
    const wrapper = mount(OverallUrgencyCard, { props: { urgency: urgency() } });
    await wrapper.find('.overall-urgency-card__reference').trigger('click');
    expect(wrapper.emitted('navigate-reference')).toEqual([['path:abc123']]);
  });
});
