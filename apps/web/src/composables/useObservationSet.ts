import { onMounted, ref } from 'vue';
import { getObservationSet, ObservationSetParseError } from '../api/analyses';
import { ApiError } from '../api/client';
import type { ObservationSetDto } from '../api/schemas';

/** Fetches + Zod-validates the ObservationSet once the Result page mounts. */
export function useObservationSet(analysisId: string) {
  const observationSet = ref<ObservationSetDto | null>(null);
  const error = ref<ApiError | ObservationSetParseError | null>(null);
  const isLoading = ref(true);

  async function load(): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      observationSet.value = await getObservationSet(analysisId);
    } catch (err) {
      error.value =
        err instanceof ApiError || err instanceof ObservationSetParseError
          ? err
          : new ApiError(0, 'UNKNOWN_ERROR', 'Failed to load the ObservationSet');
    } finally {
      isLoading.value = false;
    }
  }

  onMounted(() => void load());

  return { observationSet, error, isLoading, reload: load };
}
