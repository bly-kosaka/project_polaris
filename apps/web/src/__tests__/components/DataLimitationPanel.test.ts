import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DataLimitationPanel from '../../components/DataLimitationPanel.vue';

const emptyView = { totalGroups: 0, selectedGroups: 0, omittedGroups: 0 };

function cleanProps() {
  return {
    parseSummary: { totalLines: 100, parsedLines: 100, partialLines: 0, failedLines: 0, warnings: [] },
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
    exclusion: { excludedEntryCount: 0 },
  };
}

describe('DataLimitationPanel', () => {
  it('renders nothing when the run has no limitations', () => {
    const wrapper = mount(DataLimitationPanel, { props: cleanProps() });
    expect(wrapper.html()).toBe('<!--v-if-->');
  });

  it('is visible whenever there are partial/failed parse lines — never hidden or collapsed away', () => {
    const props = cleanProps();
    props.parseSummary = { totalLines: 100, parsedLines: 90, partialLines: 5, failedLines: 5, warnings: [] };
    const wrapper = mount(DataLimitationPanel, { props });
    expect(wrapper.text()).toContain('データの制限事項');
    expect(wrapper.text()).toContain('100行中90行');
  });

  it('is visible when a view was truncated', () => {
    const props = cleanProps();
    props.truncation.truncated = true;
    props.truncation.views.paths = { totalGroups: 500, selectedGroups: 200, omittedGroups: 300 };
    const wrapper = mount(DataLimitationPanel, { props });
    expect(wrapper.text()).toContain('300件を省略');
  });
});
