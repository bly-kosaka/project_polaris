<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import LoadingState from '../components/LoadingState.vue';
import ErrorState from '../components/ErrorState.vue';
import StatusBadge from '../components/StatusBadge.vue';
import TabNav, { type TabNavItem } from '../components/TabNav.vue';
import DataLimitationPanel from '../components/DataLimitationPanel.vue';
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
import { getAnalysis } from '../api/analyses';
import { analysisStatusLabel } from '../utils/statusLabels';
import type { AnalysisDetailDto } from '../types/dto';
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

async function loadAnalysis(): Promise<void> {
  try {
    analysis.value = await getAnalysis(props.analysisId);
  } catch (err) {
    analysisError.value = err;
  }
}

onMounted(() => void loadAnalysis());

const { observationSet, error: observationError, isLoading } = useObservationSet(props.analysisId);

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

watch(activeTab, () => {
  searchQuery.value = '';
});

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
      <DataLimitationPanel
        :parse-summary="observationSet.parseSummary"
        :truncation="observationSet.truncation"
        :redaction="observationSet.redaction"
        :exclusion="observationSet.exclusion"
      />

      <TabNav v-model="activeTab" :tabs="TABS" class="analysis-result-page__tabs" />

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
