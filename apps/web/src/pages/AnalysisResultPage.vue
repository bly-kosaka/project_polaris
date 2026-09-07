<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import LoadingState from '../components/LoadingState.vue';
import ErrorState from '../components/ErrorState.vue';
import StatusBadge from '../components/StatusBadge.vue';
import TabNav, { type TabNavItem } from '../components/TabNav.vue';
import DataLimitationPanel from '../components/DataLimitationPanel.vue';
import AIStatusPanel from '../components/ai/AIStatusPanel.vue';
import OverallUrgencyCard from '../components/ai/OverallUrgencyCard.vue';
import AISummary from '../components/ai/AISummary.vue';
import FindingList from '../components/ai/FindingList.vue';
import AIDataLimitations from '../components/ai/AIDataLimitations.vue';
import DetailDrawer from '../components/DetailDrawer.vue';
import KeyValueList, { type KeyValueItem } from '../components/KeyValueList.vue';
import DistributionList from '../components/DistributionList.vue';
import KnownInformationBadge from '../components/KnownInformationBadge.vue';
import PathTable from '../components/aggregation/PathTable.vue';
import SourceIpTable from '../components/aggregation/SourceIpTable.vue';
import StatusTable from '../components/aggregation/StatusTable.vue';
import MethodTable from '../components/aggregation/MethodTable.vue';
import UserAgentTable from '../components/aggregation/UserAgentTable.vue';
import TimeTable from '../components/aggregation/TimeTable.vue';
import { useObservationSet } from '../composables/useObservationSet';
import { useAIExplanation } from '../composables/useAIExplanation';
import { getAnalysis } from '../api/analyses';
import { getProject } from '../api/projects';
import { analysisStatusLabel, analyzerStatusLabel } from '../utils/statusLabels';
import { resolveAiReference } from '../utils/aiReferenceResolver';
import type { AnalysisDetailDto, ProjectDetailDto } from '../types/dto';
import type {
  PathAggregationDto,
  SourceIpAggregationDto,
  StatusAggregationDto,
  MethodAggregationDto,
  UserAgentAggregationDto,
  TimeBucketAggregationDto,
  SelectedGroup,
  Group,
} from '../api/schemas';

const props = defineProps<{ analysisId: string }>();

const analysis = ref<AnalysisDetailDto | null>(null);
const analysisError = ref<unknown>(null);
const project = ref<ProjectDetailDto | null>(null);

async function loadAnalysis(): Promise<void> {
  try {
    analysis.value = await getAnalysis(props.analysisId);
  } catch (err) {
    analysisError.value = err;
    return;
  }
  try {
    project.value = await getProject(analysis.value.projectId);
  } catch {
    // Project name is a nice-to-have on this screen — a failure fetching it
    // must not block the rest of the Result page from rendering.
  }
}

onMounted(() => void loadAnalysis());

const { observationSet, error: observationError, isLoading } = useObservationSet(props.analysisId);
const { aiStatus, aiExplanation, stuck: aiStuck, retry: retryAiExplanation } = useAIExplanation(props.analysisId);

type TabKey = 'path' | 'sourceIp' | 'status' | 'method' | 'userAgent' | 'time';

const TABS: TabNavItem[] = [
  { key: 'path', label: 'Path' },
  { key: 'sourceIp', label: 'Source IP' },
  { key: 'status', label: 'Status' },
  { key: 'method', label: 'Method' },
  { key: 'userAgent', label: 'User-Agent' },
  { key: 'time', label: 'Time' },
];

const activeTab = ref<string>('path' satisfies TabKey);
const searchQuery = ref('');

/**
 * Clears the search only on a manual Tab click — not on every activeTab
 * change. A plain `watch(activeTab, ...)` used to do this and broke Cross
 * Aggregation Navigation (goToPath/goToSourceIp below): since Vue's watch
 * callback runs on the next flush, it fired *after* those functions had
 * already set both activeTab and searchQuery, wiping the search value they
 * had just set (42_Sprint_5_Review.md M-03).
 */
function onManualTabChange(tab: string): void {
  activeTab.value = tab;
  searchQuery.value = '';
}

function matches(value: string): boolean {
  const q = searchQuery.value.trim().toLowerCase();
  return q.length === 0 || value.toLowerCase().includes(q);
}

const filteredPaths = computed(() => (observationSet.value?.aggregations.paths ?? []).filter((g) => matches(g.value.path)));
const filteredSourceIps = computed(() =>
  (observationSet.value?.aggregations.sourceIps ?? []).filter((g) => matches(g.value.sourceIp)),
);
const filteredStatuses = computed(() =>
  (observationSet.value?.aggregations.statuses ?? []).filter((g) => matches(String(g.value.status))),
);
const filteredMethods = computed(() =>
  (observationSet.value?.aggregations.methods ?? []).filter((g) => matches(g.value.method)),
);
const filteredUserAgents = computed(() =>
  (observationSet.value?.aggregations.userAgents ?? []).filter((g) => matches(g.value.userAgent)),
);

type AnyRow =
  | SelectedGroup<PathAggregationDto>
  | SelectedGroup<SourceIpAggregationDto>
  | Group<StatusAggregationDto>
  | Group<MethodAggregationDto>
  | SelectedGroup<UserAgentAggregationDto>
  | Group<TimeBucketAggregationDto>;

const selectedTab = ref<TabKey | null>(null);
const selectedRow = ref<AnyRow | null>(null);

function openDrawer(tab: TabKey, row: AnyRow): void {
  selectedTab.value = tab;
  selectedRow.value = row;
}
function closeDrawer(): void {
  selectedRow.value = null;
  selectedTab.value = null;
}

const drawerOpen = computed({
  get: () => selectedRow.value !== null,
  set: (value: boolean) => {
    if (!value) closeDrawer();
  },
});

function goToPath(path: string): void {
  activeTab.value = 'path';
  searchQuery.value = path;
  closeDrawer();
}
function goToSourceIp(sourceIp: string): void {
  activeTab.value = 'sourceIp';
  searchQuery.value = sourceIp;
  closeDrawer();
}

/**
 * A Finding/Overall Urgency evidence-link click (md/44 §72-73) — resolves
 * `groupId` to a tab + display value via the already-loaded ObservationSet,
 * then reuses the same tab-switch-plus-search mechanism goToPath/goToSourceIp
 * already use.
 */
function onNavigateReference(groupId: string): void {
  if (!observationSet.value) return;
  const resolved = resolveAiReference(observationSet.value, groupId);
  if (!resolved) return;
  activeTab.value = resolved.tab;
  searchQuery.value = resolved.searchValue;
  closeDrawer();
}

const pathRow = computed(() =>
  selectedTab.value === 'path' ? (selectedRow.value as SelectedGroup<PathAggregationDto>) : null,
);
const sourceIpRow = computed(() =>
  selectedTab.value === 'sourceIp' ? (selectedRow.value as SelectedGroup<SourceIpAggregationDto>) : null,
);
const statusRow = computed(() =>
  selectedTab.value === 'status' ? (selectedRow.value as Group<StatusAggregationDto>) : null,
);
const methodRow = computed(() =>
  selectedTab.value === 'method' ? (selectedRow.value as Group<MethodAggregationDto>) : null,
);
const userAgentRow = computed(() =>
  selectedTab.value === 'userAgent' ? (selectedRow.value as SelectedGroup<UserAgentAggregationDto>) : null,
);
const timeRow = computed(() =>
  selectedTab.value === 'time' ? (selectedRow.value as Group<TimeBucketAggregationDto>) : null,
);

function baseItems(groupId: string, requestCount: number, firstSeen: string | null, lastSeen: string | null): KeyValueItem[] {
  return [
    { key: 'groupId', label: 'Group ID', value: groupId },
    { key: 'requestCount', label: 'Requests', value: requestCount },
    { key: 'firstSeen', label: 'First Seen', value: firstSeen ?? '—' },
    { key: 'lastSeen', label: 'Last Seen', value: lastSeen ?? '—' },
  ];
}

/**
 * Result Header Overview (42_Sprint_5_Review.md M-02) — Project Name,
 * Analysis作成日時, 解析期間, リクエスト数, Analyzer状態. Depends on both
 * `analysis` (createdAt/analyzerStatus) and `observationSet.overview`
 * (totalRequests/firstSeen/lastSeen), so it only renders once both have
 * loaded (see the template's `v-else-if="observationSet"` gate).
 */
const overviewItems = computed<KeyValueItem[]>(() => {
  if (!analysis.value) return [];
  const overview = observationSet.value?.overview;
  const period = overview ? `${overview.firstSeen ?? '—'} 〜 ${overview.lastSeen ?? '—'}` : '—';
  return [
    { key: 'projectName', label: 'Project名', value: project.value?.name ?? '—' },
    { key: 'createdAt', label: 'Analysis作成日時', value: analysis.value.createdAt },
    { key: 'period', label: '解析期間', value: period },
    { key: 'totalRequests', label: 'リクエスト数', value: overview?.totalRequests ?? '—' },
    { key: 'analyzerStatus', label: 'Analyzer状態', value: analysis.value.analyzerStatus ?? '—' },
  ];
});

const drawerTitle = computed(() => {
  if (pathRow.value) return pathRow.value.value.path;
  if (sourceIpRow.value) return sourceIpRow.value.value.sourceIp;
  if (statusRow.value) return String(statusRow.value.value.status);
  if (methodRow.value) return methodRow.value.value.method;
  if (userAgentRow.value) return userAgentRow.value.value.userAgent;
  if (timeRow.value) return timeRow.value.value.bucketStart;
  return '';
});
</script>

<template>
  <ErrorState v-if="analysisError" :error="analysisError" />
  <template v-else>
    <PageHeader :title="analysis?.originalFileName ?? '解析結果'">
      <template #actions>
        <StatusBadge v-if="analysis" v-bind="analysisStatusLabel(analysis.status)" />
      </template>
    </PageHeader>

    <LoadingState v-if="isLoading" message="解析結果を読み込んでいます…" />
    <ErrorState v-else-if="observationError" :error="observationError" />
    <template v-else-if="observationSet">
      <KeyValueList :items="overviewItems" class="analysis-result-page__overview">
        <template #value-analyzerStatus>
          <StatusBadge v-if="analysis?.analyzerStatus" v-bind="analyzerStatusLabel(analysis.analyzerStatus)" />
          <span v-else>—</span>
        </template>
      </KeyValueList>

      <DataLimitationPanel
        :parse-summary="observationSet.parseSummary"
        :truncation="observationSet.truncation"
        :redaction="observationSet.redaction"
        :exclusion="observationSet.exclusion"
      />

      <AIStatusPanel
        v-if="aiStatus === 'queued' || aiStatus === 'running' || aiStatus === 'failed' || (aiStatus === 'not_requested' && aiStuck)"
        :ai-status="aiStatus"
        :stuck="aiStuck"
        @retry="retryAiExplanation"
      />
      <template v-if="aiStatus === 'success' && aiExplanation">
        <OverallUrgencyCard :urgency="aiExplanation.overallUrgency" @navigate-reference="onNavigateReference" />
        <AISummary :summary="aiExplanation.summary" />
        <FindingList :findings="aiExplanation.findings" @navigate-reference="onNavigateReference" />
        <AIDataLimitations :data-limitations="aiExplanation.dataLimitations" />
      </template>

      <TabNav :model-value="activeTab" :tabs="TABS" class="analysis-result-page__tabs" @update:model-value="onManualTabChange" />

      <input
        v-if="activeTab !== 'time'"
        v-model="searchQuery"
        type="search"
        class="analysis-result-page__search"
        placeholder="絞り込み検索"
        aria-label="絞り込み検索"
      />

      <PathTable v-if="activeTab === 'path'" :groups="filteredPaths" @row-click="(row) => openDrawer('path', row)" />
      <SourceIpTable
        v-else-if="activeTab === 'sourceIp'"
        :groups="filteredSourceIps"
        @row-click="(row) => openDrawer('sourceIp', row)"
      />
      <StatusTable
        v-else-if="activeTab === 'status'"
        :groups="filteredStatuses"
        @row-click="(row) => openDrawer('status', row)"
      />
      <MethodTable
        v-else-if="activeTab === 'method'"
        :groups="filteredMethods"
        @row-click="(row) => openDrawer('method', row)"
      />
      <UserAgentTable
        v-else-if="activeTab === 'userAgent'"
        :groups="filteredUserAgents"
        @row-click="(row) => openDrawer('userAgent', row)"
      />
      <TimeTable
        v-else-if="activeTab === 'time'"
        :one-minute="observationSet.aggregations.time.oneMinute"
        :five-minute="observationSet.aggregations.time.fiveMinute"
        @row-click="(row) => openDrawer('time', row)"
      />

      <DetailDrawer v-model="drawerOpen" :title="drawerTitle">
        <template v-if="pathRow">
          <KeyValueList
            :items="[
              ...baseItems(pathRow.groupId, pathRow.value.requestCount, pathRow.value.firstSeen, pathRow.value.lastSeen),
              { key: 'distinctSourceIpCount', label: 'Distinct Source IP', value: pathRow.value.distinctSourceIpCount },
              { key: 'distinctUserAgentCount', label: 'Distinct UA', value: pathRow.value.distinctUserAgentCount },
            ]"
          />
          <h3 class="analysis-result-page__drawer-subhead">Method分布</h3>
          <DistributionList :entries="pathRow.value.methodDistribution" />
          <h3 class="analysis-result-page__drawer-subhead">Status分布</h3>
          <DistributionList :entries="pathRow.value.statusDistribution" />
          <template v-if="pathRow.value.knownInformation.length > 0">
            <h3 class="analysis-result-page__drawer-subhead">Known Information</h3>
            <div class="analysis-result-page__badges">
              <KnownInformationBadge v-for="m in pathRow.value.knownInformation" :key="m.id" :match="m" />
            </div>
          </template>
          <template v-if="pathRow.value.sampleSourceIps.length > 0">
            <h3 class="analysis-result-page__drawer-subhead">関連するSource IP</h3>
            <div class="analysis-result-page__chips">
              <button
                v-for="ip in pathRow.value.sampleSourceIps"
                :key="ip"
                type="button"
                class="analysis-result-page__chip"
                @click="goToSourceIp(ip)"
              >
                {{ ip }}
              </button>
            </div>
          </template>
        </template>

        <template v-else-if="sourceIpRow">
          <KeyValueList
            :items="[
              ...baseItems(
                sourceIpRow.groupId,
                sourceIpRow.value.requestCount,
                sourceIpRow.value.firstSeen,
                sourceIpRow.value.lastSeen,
              ),
              { key: 'distinctPathCount', label: 'Distinct Path', value: sourceIpRow.value.distinctPathCount },
              { key: 'distinctUserAgentCount', label: 'Distinct UA', value: sourceIpRow.value.distinctUserAgentCount },
            ]"
          />
          <h3 class="analysis-result-page__drawer-subhead">Method分布</h3>
          <DistributionList :entries="sourceIpRow.value.methodDistribution" />
          <h3 class="analysis-result-page__drawer-subhead">Status分布</h3>
          <DistributionList :entries="sourceIpRow.value.statusDistribution" />
          <template v-if="sourceIpRow.value.topPaths.length > 0">
            <h3 class="analysis-result-page__drawer-subhead">関連するPath</h3>
            <div class="analysis-result-page__chips">
              <button
                v-for="p in sourceIpRow.value.topPaths"
                :key="p.value"
                type="button"
                class="analysis-result-page__chip"
                @click="goToPath(p.value)"
              >
                {{ p.value }}
              </button>
            </div>
          </template>
        </template>

        <template v-else-if="statusRow">
          <KeyValueList
            :items="baseItems(statusRow.groupId, statusRow.value.requestCount, statusRow.value.firstSeen, statusRow.value.lastSeen)"
          />
          <template v-if="statusRow.value.topPaths.length > 0">
            <h3 class="analysis-result-page__drawer-subhead">関連するPath</h3>
            <div class="analysis-result-page__chips">
              <button
                v-for="p in statusRow.value.topPaths"
                :key="p.value"
                type="button"
                class="analysis-result-page__chip"
                @click="goToPath(p.value)"
              >
                {{ p.value }}
              </button>
            </div>
          </template>
          <template v-if="statusRow.value.topSourceIps.length > 0">
            <h3 class="analysis-result-page__drawer-subhead">関連するSource IP</h3>
            <div class="analysis-result-page__chips">
              <button
                v-for="ip in statusRow.value.topSourceIps"
                :key="ip.value"
                type="button"
                class="analysis-result-page__chip"
                @click="goToSourceIp(ip.value)"
              >
                {{ ip.value }}
              </button>
            </div>
          </template>
        </template>

        <template v-else-if="methodRow">
          <KeyValueList
            :items="baseItems(methodRow.groupId, methodRow.value.requestCount, methodRow.value.firstSeen, methodRow.value.lastSeen)"
          />
          <template v-if="methodRow.value.topPaths.length > 0">
            <h3 class="analysis-result-page__drawer-subhead">関連するPath</h3>
            <div class="analysis-result-page__chips">
              <button
                v-for="p in methodRow.value.topPaths"
                :key="p.value"
                type="button"
                class="analysis-result-page__chip"
                @click="goToPath(p.value)"
              >
                {{ p.value }}
              </button>
            </div>
          </template>
        </template>

        <template v-else-if="userAgentRow">
          <KeyValueList
            :items="[
              ...baseItems(
                userAgentRow.groupId,
                userAgentRow.value.requestCount,
                userAgentRow.value.firstSeen,
                userAgentRow.value.lastSeen,
              ),
              { key: 'userAgent', label: 'User-Agent', value: userAgentRow.value.userAgent },
            ]"
          />
          <h3 class="analysis-result-page__drawer-subhead">Method分布</h3>
          <DistributionList :entries="userAgentRow.value.methodDistribution" />
          <h3 class="analysis-result-page__drawer-subhead">Status分布</h3>
          <DistributionList :entries="userAgentRow.value.statusDistribution" />
          <template v-if="userAgentRow.value.topPaths.length > 0">
            <h3 class="analysis-result-page__drawer-subhead">関連するPath</h3>
            <div class="analysis-result-page__chips">
              <button
                v-for="p in userAgentRow.value.topPaths"
                :key="p.value"
                type="button"
                class="analysis-result-page__chip"
                @click="goToPath(p.value)"
              >
                {{ p.value }}
              </button>
            </div>
          </template>
        </template>

        <template v-else-if="timeRow">
          <KeyValueList
            :items="[
              { key: 'bucketStart', label: 'Time', value: timeRow.value.bucketStart },
              { key: 'requestCount', label: 'Requests', value: timeRow.value.requestCount },
              { key: 'distinctSourceIpCount', label: 'Distinct Source IP', value: timeRow.value.distinctSourceIpCount },
              { key: 'distinctPathCount', label: 'Distinct Path', value: timeRow.value.distinctPathCount },
            ]"
          />
          <h3 class="analysis-result-page__drawer-subhead">Status分布</h3>
          <DistributionList :entries="timeRow.value.statusDistribution" />
        </template>
      </DetailDrawer>
    </template>
  </template>
</template>

<style scoped>
.analysis-result-page__overview {
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.analysis-result-page__tabs {
  margin-bottom: var(--space-4);
}

.analysis-result-page__search {
  display: block;
  width: 100%;
  max-width: 320px;
  margin-bottom: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}

.analysis-result-page__drawer-subhead {
  margin-top: var(--space-4);
  margin-bottom: var(--space-2);
  font-size: var(--font-size-base);
  font-weight: 700;
}

.analysis-result-page__badges,
.analysis-result-page__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.analysis-result-page__chip {
  appearance: none;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  padding: 2px 10px;
  font-size: var(--font-size-sm);
  cursor: pointer;
  color: var(--color-info);
}

.analysis-result-page__chip:hover {
  background: var(--color-info-bg);
}
</style>
