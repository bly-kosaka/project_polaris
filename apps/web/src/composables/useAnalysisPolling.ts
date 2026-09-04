import { onUnmounted, ref } from 'vue';
import { getAnalysis } from '../api/analyses';
import { ApiError } from '../api/client';
import type { AnalysisDetailDto } from '../types/dto';

const TERMINAL_STATUSES = new Set(['analyzer_result_ready', 'failed', 'completed']);
const POLL_INTERVAL_MS = 2000;

/**
 * Polls `GET /analyses/:id` (39_Development_Setup_and_Fifth_Sprint.md §24)
 * until Analysis.status reaches a terminal value. Uses chained `setTimeout`
 * rather than `setInterval` so a slow response can't cause overlapping
 * requests. Stops on unmount (`onUnmounted`) — the Processing page
 * navigating away must not leave a stray timer running.
 */
export function useAnalysisPolling(analysisId: string, intervalMs = POLL_INTERVAL_MS) {
  const analysis = ref<AnalysisDetailDto | null>(null);
  const error = ref<ApiError | null>(null);
  const isPolling = ref(true);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;

  async function poll(): Promise<void> {
    if (cancelled) return;
    try {
      const result = await getAnalysis(analysisId);
      if (cancelled) return;
      analysis.value = result;
      if (TERMINAL_STATUSES.has(result.status)) {
        isPolling.value = false;
        return;
      }
    } catch (err) {
      if (cancelled) return;
      error.value = err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN_ERROR', 'Failed to poll Analysis status');
      isPolling.value = false;
      return;
    }
    timer = setTimeout(() => void poll(), intervalMs);
  }

  void poll();

  onUnmounted(() => {
    cancelled = true;
    isPolling.value = false;
    if (timer !== undefined) clearTimeout(timer);
  });

  return { analysis, error, isPolling };
}
