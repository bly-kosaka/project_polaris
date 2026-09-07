import { describe, expect, it, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import AnalysisResultPage from '../../pages/AnalysisResultPage.vue';
import * as analysesApi from '../../api/analyses';
import * as projectsApi from '../../api/projects';
import * as aiExplanationApi from '../../api/ai-explanation';
import { ApiError } from '../../api/client';
import type { ObservationSetDto } from '../../api/schemas';

function mockProject(): ReturnType<typeof projectsApi.getProject> {
  return Promise.resolve({ id: 'p1', name: 'My Project', status: 'active', createdAt: 'x', updatedAt: 'x' });
}

const emptyView = { totalGroups: 0, selectedGroups: 0, omittedGroups: 0 };

function baseObservationSet(): ObservationSetDto {
  return {
    schemaVersion: '1.0.0',
    overview: {
      totalRequests: 10,
      parsedRequests: 8,
      partialRequests: 1,
      failedRequests: 1,
      distinctSourceIps: 2,
      distinctPaths: 1,
      distinctUserAgents: 1,
      firstSeen: '2026-01-01T00:00:00Z',
      lastSeen: '2026-01-01T01:00:00Z',
      totalResponseBytes: 1000,
      statusDistribution: [{ key: 200, count: 8 }],
      methodDistribution: [{ key: 'GET', count: 8 }],
    },
    parseSummary: {
      totalLines: 10,
      parsedLines: 8,
      partialLines: 1,
      failedLines: 1,
      warnings: [{ code: 'UNRECOGNIZED_FIELD', count: 1 }],
    },
    aggregations: {
      paths: [
        {
          groupId: 'path-1',
          selectionReasons: ['request_count'],
          value: {
            path: '/api/users',
            requestCount: 8,
            distinctSourceIpCount: 2,
            distinctUserAgentCount: 1,
            queryVariantCount: 0,
            methodDistribution: [{ key: 'GET', count: 8 }],
            statusDistribution: [{ key: 200, count: 8 }],
            referrerHostDistribution: [],
            responseSize: { count: 8, total: 1000, min: 100, max: 200, average: 125 },
            firstSeen: '2026-01-01T00:00:00Z',
            lastSeen: '2026-01-01T01:00:00Z',
            timeDistribution: [],
            sampleSourceIps: ['203.0.113.1'],
            sampleQueries: [],
            sampleReferrers: [],
            knownInformation: [
              { id: 'ki-1', title: 'Health Check Endpoint', source: 'built_in', isPrimary: true },
            ],
          },
        },
      ],
      sourceIps: [
        {
          groupId: 'ip-1',
          selectionReasons: ['request_count'],
          value: {
            sourceIp: '203.0.113.1',
            requestCount: 8,
            distinctPathCount: 1,
            distinctUserAgentCount: 1,
            methodDistribution: [{ key: 'GET', count: 8 }],
            statusDistribution: [{ key: 200, count: 8 }],
            responseSize: { count: 8, total: 1000, min: 100, max: 200, average: 125 },
            firstSeen: '2026-01-01T00:00:00Z',
            lastSeen: '2026-01-01T01:00:00Z',
            timeDistribution: [],
            topPaths: [{ value: '/api/users', count: 8 }],
          },
        },
      ],
      sourceIpPaths: [],
      statuses: [
        {
          groupId: 'status-200',
          value: {
            status: 200,
            requestCount: 8,
            distinctPathCount: 1,
            distinctSourceIpCount: 2,
            topPaths: [{ value: '/api/users', count: 8 }],
            topSourceIps: [{ value: '203.0.113.1', count: 8 }],
            firstSeen: '2026-01-01T00:00:00Z',
            lastSeen: '2026-01-01T01:00:00Z',
          },
        },
      ],
      methods: [
        {
          groupId: 'method-get',
          value: {
            method: 'GET',
            requestCount: 8,
            distinctPathCount: 1,
            distinctSourceIpCount: 2,
            topPaths: [{ value: '/api/users', count: 8 }],
            topSourceIps: [{ value: '203.0.113.1', count: 8 }],
            firstSeen: '2026-01-01T00:00:00Z',
            lastSeen: '2026-01-01T01:00:00Z',
          },
        },
      ],
      userAgents: [],
      time: { oneMinute: [], fiveMinute: [] },
    },
    truncation: {
      truncated: false,
      views: {
        paths: emptyView,
        sourceIps: emptyView,
        sourceIpPaths: emptyView,
        statuses: emptyView,
        methods: emptyView,
        userAgents: emptyView,
        time1m: emptyView,
        time5m: emptyView,
      },
      knownInformationOmissions: [],
    },
    redaction: {
      appliedParameterNames: [],
      redactedQuerySampleCount: 0,
      redactedReferrerSampleCount: 0,
      droppedQuerySampleCount: 0,
      droppedReferrerSampleCount: 0,
    },
    knownInformation: { builtInDatasetVersion: '1', matchedPathCount: 1, matchedEntryIds: ['ki-1'], omittedMatchedGroupCount: 0 },
    references: { resolvedPathRefs: 0, resolvedSourceIpRefs: 0, unresolvedPathRefs: 0, unresolvedSourceIpRefs: 0 },
    exclusion: { excludedEntryCount: 0 },
  };
}

describe('AnalysisResultPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the Data Limitation panel whenever the parse had partial/failed lines', async () => {
    vi.spyOn(analysesApi, 'getAnalysis').mockResolvedValue({
      id: 'a1',
      projectId: 'p1',
      status: 'analyzer_result_ready',
      aiStatus: 'not_requested',
      createdAt: 'x',
      updatedAt: 'x',
      originalFileName: 'access.log',
    });
    vi.spyOn(projectsApi, 'getProject').mockImplementation(mockProject);
    vi.spyOn(analysesApi, 'getObservationSet').mockResolvedValue(baseObservationSet());

    const wrapper = mount(AnalysisResultPage, { props: { analysisId: 'a1' } });
    await flushPromises();

    expect(wrapper.text()).toContain('データの制限事項');
    expect(wrapper.text()).toContain('10行中8行');
    wrapper.unmount();
  });

  it('renders the Path tab by default and switches to the Source IP tab on tab click', async () => {
    vi.spyOn(analysesApi, 'getAnalysis').mockResolvedValue({
      id: 'a1',
      projectId: 'p1',
      status: 'analyzer_result_ready',
      aiStatus: 'not_requested',
      createdAt: 'x',
      updatedAt: 'x',
    });
    vi.spyOn(projectsApi, 'getProject').mockImplementation(mockProject);
    vi.spyOn(analysesApi, 'getObservationSet').mockResolvedValue(baseObservationSet());

    const wrapper = mount(AnalysisResultPage, { props: { analysisId: 'a1' } });
    await flushPromises();

    expect(wrapper.text()).toContain('/api/users');

    const tabs = wrapper.findAll('[role="tab"]');
    const sourceIpTab = tabs.find((t) => t.text() === 'Source IP');
    await sourceIpTab?.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('203.0.113.1');
    wrapper.unmount();
  });

  it('renders Known Information as a non-danger badge', async () => {
    vi.spyOn(analysesApi, 'getAnalysis').mockResolvedValue({
      id: 'a1',
      projectId: 'p1',
      status: 'analyzer_result_ready',
      aiStatus: 'not_requested',
      createdAt: 'x',
      updatedAt: 'x',
    });
    vi.spyOn(projectsApi, 'getProject').mockImplementation(mockProject);
    vi.spyOn(analysesApi, 'getObservationSet').mockResolvedValue(baseObservationSet());

    const wrapper = mount(AnalysisResultPage, { props: { analysisId: 'a1' } });
    await flushPromises();

    const badge = wrapper.find('.known-information-badge');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe('Health Check Endpoint');
    expect(badge.classes().join(' ')).not.toMatch(/danger/);
    wrapper.unmount();
  });

  it('shows a failure message, never "no problem" copy, when the Analyzer failed', async () => {
    vi.spyOn(analysesApi, 'getAnalysis').mockResolvedValue({
      id: 'a1',
      projectId: 'p1',
      status: 'failed',
      aiStatus: 'not_requested',
      createdAt: 'x',
      updatedAt: 'x',
    });
    vi.spyOn(projectsApi, 'getProject').mockImplementation(mockProject);
    vi.spyOn(analysesApi, 'getObservationSet').mockRejectedValue(
      new ApiError(409, 'ANALYSIS_FAILED', 'analysis failed'),
    );

    const wrapper = mount(AnalysisResultPage, { props: { analysisId: 'a1' } });
    await flushPromises();

    expect(wrapper.text()).toContain('失敗');
    expect(wrapper.text()).not.toMatch(/問題(は)?ありません|安全です/);
    wrapper.unmount();
  });

  it('shows the Result Overview with Project name, request count, period, and Analyzer status (M-02)', async () => {
    vi.spyOn(analysesApi, 'getAnalysis').mockResolvedValue({
      id: 'a1',
      projectId: 'p1',
      status: 'analyzer_result_ready',
      analyzerStatus: 'success',
      aiStatus: 'not_requested',
      createdAt: '2026-01-02T00:00:00Z',
      updatedAt: 'x',
    });
    vi.spyOn(projectsApi, 'getProject').mockImplementation(mockProject);
    vi.spyOn(analysesApi, 'getObservationSet').mockResolvedValue(baseObservationSet());

    const wrapper = mount(AnalysisResultPage, { props: { analysisId: 'a1' } });
    await flushPromises();

    expect(wrapper.text()).toContain('My Project');
    expect(wrapper.text()).toContain('2026-01-02T00:00:00Z');
    expect(wrapper.text()).toContain('2026-01-01T00:00:00Z 〜 2026-01-01T01:00:00Z');
    expect(wrapper.text()).toContain('解析完了');
    wrapper.unmount();
  });

  it('keeps the search filter across a Cross Aggregation Navigation (both directions), clearing it only on a manual Tab click (M-03)', async () => {
    vi.spyOn(analysesApi, 'getAnalysis').mockResolvedValue({
      id: 'a1',
      projectId: 'p1',
      status: 'analyzer_result_ready',
      aiStatus: 'not_requested',
      createdAt: 'x',
      updatedAt: 'x',
    });
    vi.spyOn(projectsApi, 'getProject').mockImplementation(mockProject);
    vi.spyOn(analysesApi, 'getObservationSet').mockResolvedValue(baseObservationSet());

    const wrapper = mount(AnalysisResultPage, { props: { analysisId: 'a1' } });
    await flushPromises();

    // Path (default tab) row -> Drawer -> "関連するSource IP" -> Source IP
    // tab, search prefilled with the target Source IP and not reset.
    const pathRow = wrapper.findAll('.data-table__row').find((r) => r.text().includes('/api/users'));
    await pathRow?.trigger('click');
    await flushPromises();

    const sourceIpChip = wrapper.findAll('.analysis-result-page__chip').find((c) => c.text() === '203.0.113.1');
    expect(sourceIpChip).toBeTruthy();
    await sourceIpChip?.trigger('click');
    await flushPromises();

    let searchInput = wrapper.find('.analysis-result-page__search');
    expect((searchInput.element as HTMLInputElement).value).toBe('203.0.113.1');
    expect(wrapper.text()).toContain('203.0.113.1');

    // Source IP row -> Drawer -> "関連するPath" -> Path tab, search
    // prefilled with the target Path.
    const sourceIpRow = wrapper.findAll('.data-table__row').find((r) => r.text().includes('203.0.113.1'));
    await sourceIpRow?.trigger('click');
    await flushPromises();

    const pathChip = wrapper.findAll('.analysis-result-page__chip').find((c) => c.text() === '/api/users');
    expect(pathChip).toBeTruthy();
    await pathChip?.trigger('click');
    await flushPromises();

    searchInput = wrapper.find('.analysis-result-page__search');
    expect((searchInput.element as HTMLInputElement).value).toBe('/api/users');
    expect(wrapper.text()).toContain('/api/users');

    // A manual Tab click, by contrast, does clear the search.
    searchInput.setValue('something');
    await flushPromises();
    const statusTab = wrapper.findAll('[role="tab"]').find((t) => t.text() === 'Status');
    await statusTab?.trigger('click');
    await flushPromises();
    const pathTab = wrapper.findAll('[role="tab"]').find((t) => t.text() === 'Path');
    await pathTab?.trigger('click');
    await flushPromises();
    searchInput = wrapper.find('.analysis-result-page__search');
    expect((searchInput.element as HTMLInputElement).value).toBe('');
    wrapper.unmount();
  });

  it('shows the AI queued state without hiding the still-usable Aggregation UI (md/44 §67)', async () => {
    vi.spyOn(analysesApi, 'getAnalysis').mockResolvedValue({
      id: 'a1',
      projectId: 'p1',
      status: 'analyzer_result_ready',
      aiStatus: 'queued',
      createdAt: 'x',
      updatedAt: 'x',
    });
    vi.spyOn(projectsApi, 'getProject').mockImplementation(mockProject);
    vi.spyOn(analysesApi, 'getObservationSet').mockResolvedValue(baseObservationSet());
    const getAiExplanation = vi.spyOn(aiExplanationApi, 'getAiExplanation');

    const wrapper = mount(AnalysisResultPage, { props: { analysisId: 'a1' } });
    await flushPromises();

    expect(wrapper.text()).toContain('AIによる説明を生成しています');
    // Aggregation stays fully usable while AI is still generating.
    expect(wrapper.text()).toContain('/api/users');
    expect(getAiExplanation).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('an AI Finding evidence link switches to the referenced Aggregation tab and prefills the search (md/44 §72-73)', async () => {
    vi.spyOn(analysesApi, 'getAnalysis').mockResolvedValue({
      id: 'a1',
      projectId: 'p1',
      status: 'completed',
      aiStatus: 'success',
      createdAt: 'x',
      updatedAt: 'x',
    });
    vi.spyOn(projectsApi, 'getProject').mockImplementation(mockProject);
    // Reference Resolver reads the dimension prefix off groupId
    // (packages/analyzer/src/observation-set/group-id.ts), so the fixture's
    // Source IP row needs a real-shaped groupId here, not the plain
    // placeholder ('ip-1') baseObservationSet() otherwise uses.
    const observationSetWithPrefixedGroupId = baseObservationSet();
    observationSetWithPrefixedGroupId.aggregations.sourceIps[0]!.groupId = 'source-ip:ip-1';
    vi.spyOn(analysesApi, 'getObservationSet').mockResolvedValue(observationSetWithPrefixedGroupId);
    vi.spyOn(aiExplanationApi, 'getAiExplanation').mockResolvedValue({
      summary: 'AIによる要約テキスト',
      overallUrgency: { level: 'normal', reason: '通常の確認で問題ありません的な言い回しは使わない', references: [], limitations: [] },
      findings: [
        {
          id: 'finding-1',
          title: 'Source IPからの集中アクセス',
          observation: '観測されたIPからのアクセスです。',
          nextChecks: ['アクセス元を確認する'],
          references: [{ groupId: 'source-ip:ip-1' }],
        },
      ],
      overallNotes: [],
      dataLimitations: [],
      provider: 'openai',
      model: 'fake-model',
      promptVersion: 'initial-explanation-v1',
      createdAt: 'x',
    });

    const wrapper = mount(AnalysisResultPage, { props: { analysisId: 'a1' } });
    await flushPromises();

    expect(wrapper.text()).toContain('Source IPからの集中アクセス');

    const referenceButton = wrapper.find('.finding-card__reference');
    expect(referenceButton.exists()).toBe(true);
    await referenceButton.trigger('click');
    await flushPromises();

    const searchInput = wrapper.find('.analysis-result-page__search');
    expect((searchInput.element as HTMLInputElement).value).toBe('203.0.113.1');
    expect(wrapper.text()).toContain('203.0.113.1');

    wrapper.unmount();
  });
});
