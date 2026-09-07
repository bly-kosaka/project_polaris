import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { useAnalysisPolling } from '../../composables/useAnalysisPolling';
import * as analysesApi from '../../api/analyses';

function makeHost() {
  return defineComponent({
    props: { analysisId: { type: String, required: true } },
    setup(props) {
      const state = useAnalysisPolling(props.analysisId, 1000);
      return () => h('div', JSON.stringify(state.analysis.value));
    },
  });
}

describe('useAnalysisPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('polls at the given interval until a terminal status is reached', async () => {
    const getAnalysis = vi
      .spyOn(analysesApi, 'getAnalysis')
      .mockResolvedValueOnce({
        id: 'a1',
        projectId: 'p1',
        status: 'analyzing',
        aiStatus: 'not_requested',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      })
      .mockResolvedValueOnce({
        id: 'a1',
        projectId: 'p1',
        status: 'analyzer_result_ready',
        aiStatus: 'not_requested',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:01Z',
      });

    const wrapper = mount(makeHost(), { props: { analysisId: 'a1' } });
    await vi.waitFor(() => expect(getAnalysis).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(getAnalysis).toHaveBeenCalledTimes(2));

    await vi.advanceTimersByTimeAsync(5000);
    expect(getAnalysis).toHaveBeenCalledTimes(2);

    wrapper.unmount();
  });

  it('stops the timer on unmount', async () => {
    const getAnalysis = vi.spyOn(analysesApi, 'getAnalysis').mockResolvedValue({
      id: 'a1',
      projectId: 'p1',
      status: 'analyzing',
      aiStatus: 'not_requested',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    const wrapper = mount(makeHost(), { props: { analysisId: 'a1' } });
    await vi.waitFor(() => expect(getAnalysis).toHaveBeenCalledTimes(1));

    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(10000);
    expect(getAnalysis).toHaveBeenCalledTimes(1);
  });
});
