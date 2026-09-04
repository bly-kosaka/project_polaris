<script setup lang="ts">
import { computed } from 'vue';
import NoticePanel from './NoticePanel.vue';
import type { ObservationSetDto } from '../api/schemas';

/**
 * Surfaces every reason the shown data may be incomplete, in one place that
 * is always visible on the Result page — never collapsed into a footer or
 * omitted when the run otherwise looks clean
 * (39_Development_Setup_and_Fifth_Sprint.md §18/§47, 10_Output_Presentation.md).
 */
const props = defineProps<{
  parseSummary: ObservationSetDto['parseSummary'];
  truncation: ObservationSetDto['truncation'];
  redaction: ObservationSetDto['redaction'];
  exclusion: ObservationSetDto['exclusion'];
}>();

const hasParseIssue = computed(
  () => props.parseSummary.partialLines > 0 || props.parseSummary.failedLines > 0 || props.parseSummary.warnings.length > 0,
);

const truncatedViews = computed(() =>
  Object.entries(props.truncation.views)
    .filter(([, view]) => view.omittedGroups > 0)
    .map(([name, view]) => ({ name, ...view })),
);

const hasRedaction = computed(
  () =>
    props.redaction.appliedParameterNames.length > 0 ||
    props.redaction.redactedQuerySampleCount > 0 ||
    props.redaction.redactedReferrerSampleCount > 0,
);

const hasExclusion = computed(() => props.exclusion.excludedEntryCount > 0);

const visible = computed(
  () => hasParseIssue.value || truncatedViews.value.length > 0 || hasRedaction.value || hasExclusion.value,
);

const viewLabels: Record<string, string> = {
  paths: 'Path',
  sourceIps: 'Source IP',
  sourceIpPaths: 'Source IP × Path',
  statuses: 'Status',
  methods: 'Method',
  userAgents: 'User-Agent',
  time1m: 'Time (1分)',
  time5m: 'Time (5分)',
};
</script>

<template>
  <NoticePanel v-if="visible" title="データの制限事項" variant="warning">
    <ul class="data-limitation-panel__list">
      <li v-if="hasParseIssue">
        全{{ parseSummary.totalLines }}行中{{ parseSummary.parsedLines }}行を解析しました。
        <template v-if="parseSummary.partialLines > 0">一部解析: {{ parseSummary.partialLines }}行。</template>
        <template v-if="parseSummary.failedLines > 0">解析失敗: {{ parseSummary.failedLines }}行。</template>
        <ul v-if="parseSummary.warnings.length > 0" class="data-limitation-panel__sublist">
          <li v-for="warning in parseSummary.warnings" :key="warning.code">
            {{ warning.code }}（{{ warning.count }}件）
          </li>
        </ul>
      </li>
      <li v-for="view in truncatedViews" :key="view.name">
        {{ viewLabels[view.name] ?? view.name }}集計: {{ view.totalGroups }}件中{{ view.selectedGroups }}件を表示し、{{
          view.omittedGroups
        }}件を省略しました。
      </li>
      <li v-if="hasRedaction">クエリ文字列・Referrerの一部パラメータをマスクしました。</li>
      <li v-if="hasExclusion">{{ exclusion.excludedEntryCount }}件のログエントリを集計対象から除外しました。</li>
    </ul>
  </NoticePanel>
</template>

<style scoped>
.data-limitation-panel__list {
  margin: 0;
  padding-left: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.data-limitation-panel__sublist {
  margin: var(--space-1) 0 0;
  padding-left: var(--space-4);
  color: var(--color-text-muted);
}
</style>
