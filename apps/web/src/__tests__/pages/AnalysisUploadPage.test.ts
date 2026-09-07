import { describe, expect, it, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import AnalysisUploadPage from '../../pages/AnalysisUploadPage.vue';
import * as analysesApi from '../../api/analyses';

/**
 * 42_Sprint_5_Review.md m-01: a file exceeding the (UX-only) size limit is
 * rejected client-side, before ever calling the API — the API's own
 * `maxUploadBytes` stays the authoritative limit regardless.
 */
describe('AnalysisUploadPage file size validation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setFile(wrapper: ReturnType<typeof mount>, file: File): Promise<void> {
    const input = wrapper.find('#access-log-file').element as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    return wrapper.find('#access-log-file').trigger('change');
  }

  it('rejects a file larger than the configured limit without calling the API', async () => {
    const createAnalysis = vi.spyOn(analysesApi, 'createAnalysis');
    const wrapper = mount(AnalysisUploadPage, { props: { projectId: 'p1' } });

    const oversized = new File([new Uint8Array(60_000_000)], 'huge.log', { type: 'text/plain' });
    await setFile(wrapper, oversized);

    expect(wrapper.text()).toContain('ファイルサイズが上限');
    await wrapper.find('form').trigger('submit.prevent');
    expect(createAnalysis).not.toHaveBeenCalled();
  });

  it('accepts a file within the limit', async () => {
    const wrapper = mount(AnalysisUploadPage, { props: { projectId: 'p1' } });

    const ok = new File(['a small log'], 'small.log', { type: 'text/plain' });
    await setFile(wrapper, ok);

    expect(wrapper.text()).not.toContain('ファイルサイズが上限');
  });
});
