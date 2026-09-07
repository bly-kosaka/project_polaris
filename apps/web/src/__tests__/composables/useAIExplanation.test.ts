import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { useAIExplanation } from '../../composables/useAIExplanation';
import * as analysesApi from '../../api/analyses';
import * as aiExplanationApi from '../../api/ai-explanation';
import type { AnalysisDetailDto } from '../../types/dto';

function analysisAt(aiStatus: AnalysisDetailDto['aiStatus']): AnalysisDetailDto {
  return {
    id: 'a1',
    projectId: 'p1',
    status: 'analyzer_result_ready',
    aiStatus,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function explanationPayload() {
  return {
    summary: 'summary',
    overallUrgency: { level: 'normal' as const, reason: 'r', references: [], limitations: [] },
    findings: [],
    overallNotes: [],
    dataLimitations: [],
    provider: 'openai',
    model: 'fake-model',
    promptVersion: 'initial-explanation-v1',
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function makeHost() {
  return defineComponent({
    props: { analysisId: { type: String, required: true } },
    setup(props) {
      const state = useAIExplanation(props.analysisId, 1000);
      return () =>
        h('div', [
          h('span', { class: 'ai-status' }, state.aiStatus.value),
          h('button', { class: 'retry-button', onClick: () => void state.retry() }, 'retry'),
        ]);
    },
  });
}

describe('useAIExplanation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('F-07 regression: polls GET /analyses/:id (never GET .../explanation) through queued -> running -> success, fetching the explanation exactly once, only after success', async () => {
    const getAnalysis = vi
      .spyOn(analysesApi, 'getAnalysis')
      .mockResolvedValueOnce(analysisAt('queued'))
      .mockResolvedValueOnce(analysisAt('running'))
      .mockResolvedValueOnce(analysisAt('success'));
    const getAiExplanation = vi.spyOn(aiExplanationApi, 'getAiExplanation').mockResolvedValue(explanationPayload());

    const wrapper = mount(makeHost(), { props: { analysisId: 'a1' } });
    await vi.waitFor(() => expect(getAnalysis).toHaveBeenCalledTimes(1));
    expect(getAiExplanation).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(getAnalysis).toHaveBeenCalledTimes(2));
    expect(getAiExplanation).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(getAnalysis).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(getAiExplanation).toHaveBeenCalledTimes(1));

    // No further polling once terminal.
    await vi.advanceTimersByTimeAsync(5000);
    expect(getAnalysis).toHaveBeenCalledTimes(3);
    expect(getAiExplanation).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('never calls GET .../explanation when aiStatus reaches failed', async () => {
    const getAnalysis = vi
      .spyOn(analysesApi, 'getAnalysis')
      .mockResolvedValueOnce(analysisAt('queued'))
      .mockResolvedValueOnce(analysisAt('failed'));
    const getAiExplanation = vi.spyOn(aiExplanationApi, 'getAiExplanation');

    const wrapper = mount(makeHost(), { props: { analysisId: 'a1' } });
    await vi.waitFor(() => expect(getAnalysis).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(getAnalysis).toHaveBeenCalledTimes(2));

    await vi.advanceTimersByTimeAsync(5000);
    expect(getAnalysis).toHaveBeenCalledTimes(2);
    expect(getAiExplanation).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('retry() calls the retry endpoint and resumes polling GET /analyses/:id', async () => {
    const getAnalysis = vi
      .spyOn(analysesApi, 'getAnalysis')
      .mockResolvedValueOnce(analysisAt('failed'))
      .mockResolvedValueOnce(analysisAt('queued'))
      .mockResolvedValueOnce(analysisAt('success'));
    const getAiExplanation = vi.spyOn(aiExplanationApi, 'getAiExplanation').mockResolvedValue(explanationPayload());
    const retryAiExplanation = vi.spyOn(aiExplanationApi, 'retryAiExplanation').mockResolvedValue({ status: 'enqueued' });

    const wrapper = mount(makeHost(), { props: { analysisId: 'a1' } });
    await vi.waitFor(() => expect(getAnalysis).toHaveBeenCalledTimes(1));
    expect(wrapper.find('.ai-status').text()).toBe('failed');

    await wrapper.find('.retry-button').trigger('click');
    await vi.waitFor(() => expect(retryAiExplanation).toHaveBeenCalledTimes(1));
    expect(retryAiExplanation).toHaveBeenCalledWith('a1');

    await vi.waitFor(() => expect(getAnalysis).toHaveBeenCalledTimes(2));
    expect(wrapper.find('.ai-status').text()).toBe('queued');

    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(getAnalysis).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(getAiExplanation).toHaveBeenCalledTimes(1));
    expect(wrapper.find('.ai-status').text()).toBe('success');

    wrapper.unmount();
  });
});
