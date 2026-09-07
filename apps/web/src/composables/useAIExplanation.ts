import { onUnmounted, ref } from 'vue';
import { getAnalysis } from '../api/analyses';
import { getAiExplanation, retryAiExplanation } from '../api/ai-explanation';
import type { AIExplanationDetailDto } from '../api/ai-explanation-schema';
import { ApiError } from '../api/client';
import type { AIStatus } from '../types/dto';

const TERMINAL_AI_STATUSES = new Set<AIStatus>(['success', 'failed']);
const POLL_INTERVAL_MS = 2000;

/**
 * Polls `GET /analyses/:id` — never `GET /analyses/:id/explanation` — until
 * `aiStatus` reaches a terminal value. `GET .../explanation` itself never
 * reports `aiStatus` in its own response shape (404 for
 * not_requested/queued/running, 409 for a terminal failure), so that
 * endpoint can't be polled for status the way `useAnalysisPolling` polls
 * `GET /analyses/:id` for the Analyzer (46_Sprint_6_Plan_Final_Review.md
 * F-07). `GET .../explanation` is fetched exactly once, only after
 * `aiStatus` is observed to be `'success'` — never on `'failed'`, which
 * would just 409.
 */
export function useAIExplanation(analysisId: string, intervalMs = POLL_INTERVAL_MS) {
  const aiStatus = ref<AIStatus>('not_requested');
  const aiExplanation = ref<AIExplanationDetailDto | null>(null);
  const error = ref<ApiError | null>(null);
  const isLoading = ref(true);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;

  async function fetchExplanationOnce(): Promise<void> {
    try {
      const result = await getAiExplanation(analysisId);
      if (cancelled) return;
      aiExplanation.value = result;
    } catch (err) {
      if (cancelled) return;
      error.value = err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN_ERROR', 'Failed to fetch AI Explanation');
    }
  }

  async function poll(): Promise<void> {
    if (cancelled) return;
    try {
      const analysis = await getAnalysis(analysisId);
      if (cancelled) return;
      aiStatus.value = analysis.aiStatus;
      if (TERMINAL_AI_STATUSES.has(analysis.aiStatus)) {
        isLoading.value = false;
        if (analysis.aiStatus === 'success') await fetchExplanationOnce();
        return;
      }
    } catch (err) {
      if (cancelled) return;
      error.value = err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN_ERROR', 'Failed to poll AI Explanation status');
      isLoading.value = false;
      return;
    }
    timer = setTimeout(() => void poll(), intervalMs);
  }

  /**
   * Restarts the same polling loop — needed because a Retry moves
   * `Analysis.status` from 'completed' back through 'explaining' (decision
   * 7/9), which the one-shot Sprint 5 Processing-page polling never
   * observes since the user is already on the Result page when they click
   * Retry.
   */
  async function retry(): Promise<void> {
    error.value = null;
    aiExplanation.value = null;
    isLoading.value = true;
    try {
      await retryAiExplanation(analysisId);
    } catch (err) {
      if (cancelled) return;
      error.value = err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN_ERROR', 'Failed to retry AI Explanation');
      isLoading.value = false;
      return;
    }
    if (timer !== undefined) clearTimeout(timer);
    void poll();
  }

  void poll();

  onUnmounted(() => {
    cancelled = true;
    if (timer !== undefined) clearTimeout(timer);
  });

  return { aiStatus, aiExplanation, error, isLoading, retry };
}
