<script setup lang="ts">
import { useAuth, useUser } from '@clerk/vue';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '../components/PageHeader.vue';

const { signOut } = useAuth();
const { user } = useUser();
const router = useRouter();

const primaryEmail = computed(() => user.value?.primaryEmailAddress?.emailAddress);
const emailVerified = computed(() => user.value?.primaryEmailAddress?.verification?.status === 'verified');

async function handleSignOut(): Promise<void> {
  await signOut.value();
  await router.replace({ name: 'sign-in' });
}
</script>

<template>
  <div class="account-settings-page">
    <PageHeader title="アカウント設定" />
    <dl class="account-settings-page__info">
      <dt>メールアドレス</dt>
      <dd>{{ primaryEmail ?? '—' }}</dd>
      <dt>確認状態</dt>
      <dd>
        <span :class="['account-settings-page__badge', emailVerified ? 'is-verified' : 'is-unverified']">
          {{ emailVerified ? '確認済み' : '未確認' }}
        </span>
      </dd>
    </dl>
    <button type="button" class="account-settings-page__sign-out" @click="handleSignOut">サインアウト</button>
  </div>
</template>

<style scoped>
.account-settings-page {
  max-width: 480px;
}

.account-settings-page__info {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-2) var(--space-4);
  margin: var(--space-5) 0;
}

.account-settings-page__info dt {
  color: var(--color-text-muted);
}

.account-settings-page__badge {
  display: inline-block;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}

.account-settings-page__badge.is-verified {
  background: var(--color-surface-raised);
  color: var(--color-success, var(--color-text));
}

.account-settings-page__badge.is-unverified {
  background: var(--color-surface-raised);
  color: var(--color-warning, var(--color-text));
}

.account-settings-page__sign-out {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  cursor: pointer;
}
</style>
