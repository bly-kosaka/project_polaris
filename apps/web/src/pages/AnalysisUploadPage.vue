<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '../components/PageHeader.vue';
import ErrorState from '../components/ErrorState.vue';
import { createAnalysis, uploadAccessLog } from '../api/analyses';

const props = defineProps<{ projectId: string }>();
const router = useRouter();

/**
 * UX-only pre-check — the API's own `maxUploadBytes` limit is the
 * authoritative one and is enforced regardless of this value
 * (42_Sprint_5_Review.md m-01). Falls back to the backend's own default
 * (50MB) if the env var isn't set, so the check still does something
 * useful without requiring every environment to define it.
 */
const MAX_UPLOAD_BYTES = Number(import.meta.env.VITE_MAX_UPLOAD_BYTES ?? 52428800);

const selectedFile = ref<File | null>(null);
const validationMessage = ref<string | null>(null);
const uploadError = ref<unknown>(null);
const isSubmitting = ref(false);

/**
 * Kept once an Analysis has been created so a retry after an upload
 * failure re-attempts the upload against the same Analysis rather than
 * creating a new one each time.
 */
const pendingAnalysisId = ref<string | null>(null);

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (file !== null && file.size > MAX_UPLOAD_BYTES) {
    selectedFile.value = null;
    validationMessage.value = `ファイルサイズが上限（${formatMegabytes(MAX_UPLOAD_BYTES)}）を超えています。`;
    input.value = '';
    return;
  }
  selectedFile.value = file;
  validationMessage.value = null;
}

async function onSubmit(): Promise<void> {
  if (!selectedFile.value) {
    validationMessage.value = 'アップロードするログファイルを選択してください。';
    return;
  }
  validationMessage.value = null;
  uploadError.value = null;
  isSubmitting.value = true;
  try {
    const analysisId =
      pendingAnalysisId.value ?? (await createAnalysis(props.projectId)).analysisId;
    pendingAnalysisId.value = analysisId;
    await uploadAccessLog(analysisId, selectedFile.value);
    await router.push(`/analyses/${analysisId}/processing`);
  } catch (err) {
    uploadError.value = err;
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <PageHeader title="Analysis用ログのアップロード" />

  <form class="analysis-upload-page__form" @submit.prevent="onSubmit">
    <label class="analysis-upload-page__label" for="access-log-file">アクセスログファイル</label>
    <input id="access-log-file" type="file" class="analysis-upload-page__input" @change="onFileChange" />
    <p v-if="validationMessage" class="analysis-upload-page__validation" role="alert">{{ validationMessage }}</p>

    <button type="submit" class="analysis-upload-page__submit" :disabled="isSubmitting">
      アップロードして解析開始
    </button>
  </form>

  <ErrorState v-if="uploadError" :error="uploadError" />
</template>

<style scoped>
.analysis-upload-page__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: 480px;
}

.analysis-upload-page__label {
  font-weight: 600;
}

.analysis-upload-page__validation {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.analysis-upload-page__submit {
  align-self: flex-start;
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-5);
  background: var(--color-base);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
}

.analysis-upload-page__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
