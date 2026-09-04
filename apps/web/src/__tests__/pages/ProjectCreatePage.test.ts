import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import ProjectCreatePage from '../../pages/ProjectCreatePage.vue';
import * as projectsApi from '../../api/projects';

async function mountPage() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: ProjectCreatePage },
      { path: '/projects/:id', component: { template: '<div />' } },
    ],
  });
  router.push('/');
  await router.isReady();
  return mount(ProjectCreatePage, { global: { plugins: [router] } });
}

describe('ProjectCreatePage', () => {
  it('shows a validation message and does not call the API when the name is empty', async () => {
    const createProject = vi.spyOn(projectsApi, 'createProject');
    const wrapper = await mountPage();

    await wrapper.find('form').trigger('submit.prevent');

    expect(wrapper.text()).toContain('Project名を入力してください。');
    expect(createProject).not.toHaveBeenCalled();
  });

  it('shows a validation message when the name exceeds the max length', async () => {
    const createProject = vi.spyOn(projectsApi, 'createProject');
    const wrapper = await mountPage();

    await wrapper.find('#project-name').setValue('a'.repeat(201));
    await wrapper.find('form').trigger('submit.prevent');

    expect(wrapper.text()).toContain('200文字以内');
    expect(createProject).not.toHaveBeenCalled();
  });

  it('submits the trimmed name and navigates to the new Project on success', async () => {
    const createProject = vi
      .spyOn(projectsApi, 'createProject')
      .mockResolvedValue({ id: 'p1', name: 'My Project', status: 'active', createdAt: 'x', updatedAt: 'x' });
    const wrapper = await mountPage();

    await wrapper.find('#project-name').setValue('  My Project  ');
    await wrapper.find('form').trigger('submit.prevent');
    await vi.waitFor(() => expect(createProject).toHaveBeenCalledWith('My Project'));
  });
});
