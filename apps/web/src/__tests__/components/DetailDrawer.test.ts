import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DetailDrawer from '../../components/DetailDrawer.vue';

describe('DetailDrawer', () => {
  it('does not render when modelValue is false', () => {
    const wrapper = mount(DetailDrawer, { props: { modelValue: false, title: 'x' } });
    expect(wrapper.find('.detail-drawer').exists()).toBe(false);
  });

  it('renders the title and slot content when open', () => {
    const wrapper = mount(DetailDrawer, {
      props: { modelValue: true, title: '/api/users' },
      slots: { default: '<p>detail body</p>' },
    });
    expect(wrapper.find('.detail-drawer__title').text()).toBe('/api/users');
    expect(wrapper.html()).toContain('detail body');
  });

  it('emits update:modelValue(false) when Escape is pressed', async () => {
    const wrapper = mount(DetailDrawer, {
      props: { modelValue: true, title: 'x' },
      attachTo: document.body,
    });
    await wrapper.vm.$nextTick();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
    wrapper.unmount();
  });

  it('emits update:modelValue(false) when the close button is clicked', async () => {
    const wrapper = mount(DetailDrawer, { props: { modelValue: true, title: 'x' } });
    await wrapper.find('.detail-drawer__close').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
  });
});
