import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import FindingList from '../../../components/ai/FindingList.vue';

function findingWith(id: string, title: string) {
  return {
    id,
    title,
    observation: 'obs',
    nextChecks: [],
    references: [{ groupId: 'path:abc' }],
  };
}

describe('FindingList', () => {
  it('renders Findings in the exact order AI returned them — never re-sorted', () => {
    const findings = [findingWith('finding-2', 'Second'), findingWith('finding-1', 'First')];
    const wrapper = mount(FindingList, { props: { findings } });
    const titles = wrapper.findAll('.finding-card__title').map((t) => t.text());
    expect(titles).toEqual(['Second', 'First']);
  });

  it('shows md/44 §21\'s exact zero-finding copy, never "異常なし"/"問題なし"/"安全"/"攻撃なし"', () => {
    const wrapper = mount(FindingList, { props: { findings: [] } });
    expect(wrapper.text()).toContain('優先して説明するFindingは生成されませんでした');
    expect(wrapper.text()).not.toMatch(/異常なし|問題なし|安全|攻撃なし/);
  });

  it('re-emits navigate-reference from a FindingCard', async () => {
    const findings = [findingWith('finding-1', 'First')];
    const wrapper = mount(FindingList, { props: { findings } });
    await wrapper.find('.finding-card__reference').trigger('click');
    expect(wrapper.emitted('navigate-reference')).toEqual([['path:abc']]);
  });
});
