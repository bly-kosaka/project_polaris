<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '../components/PageHeader.vue';
import ErrorState from '../components/ErrorState.vue';
import { createProject } from '../api/projects';

const MAX_PROJECT_NAME_LENGTH = 200;

const router = useRouter();
const name = ref('');
const validationMessage = ref<string | null>(null);
const submitError = ref<unknown>(null);
const isSubmitting = ref(false);

function validate(): boolean {
  const trimmed = name.value.trim();
  if (trimmed.length === 0) {
    validationMessage.value = 'Project名を入力してください。';
    return false;
  }
  if (trimmed.length > MAX_PROJECT_NAME_LENGTH) {
    validationMessage.value = `Project名は${MAX_PROJECT_NAME_LENGTH}文字以内で入力してください。`;
    return false;
  }
  validationMessage.value = null;
  return true;
}

async function onSubmit(): Promise<void> {
  if (!validate()) return;
  isSubmitting.value = true;
  submitError.value = null;
  try {
    const project = await createProject(name.value.trim());
    await router.push(`/projects/${project.id}`);
  } catch (err) {
    submitError.value = err;
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <PageHeader title="新規Project作成" />

  <form class="project-create-page__form" @submit.prevent="onSubmit">
    <label class="project-create-page__label" for="project-name">Project名</label>
    <input
      id="project-name"
      v-model="name"
      type="text"
      class="project-create-page__input"
      :maxlength="MAX_PROJECT_NAME_LENGTH"
      required
    />
    <p v-if="validationMessage" class="project-create-page__validation" role="alert">{{ validationMessage }}</p>

    <button type="submit" class="project-create-page__submit" :disabled="isSubmitting">作成する</button>
  </form>

  <ErrorState v-if="submitError" :error="submitError" />
</template>

<style scoped>
.project-create-page__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: 480px;
}

.project-create-page__label {
  font-weight: 600;
}

.project-create-page__input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}

.project-create-page__validation {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.project-create-page__submit {
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

.project-create-page__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
