export interface ViewTruncation {
  totalGroups: number;
  selectedGroups: number;
  omittedGroups: number;
}

export interface KnownInformationOmission {
  knownInformationId: string;
  omittedGroupCount: number;
}

/** time1m/time5m are tracked independently — one never collapses into the other (28 §15.1). */
export interface TruncationSummary {
  truncated: boolean;
  views: {
    paths: ViewTruncation;
    sourceIps: ViewTruncation;
    sourceIpPaths: ViewTruncation;
    statuses: ViewTruncation;
    methods: ViewTruncation;
    userAgents: ViewTruncation;
    time1m: ViewTruncation;
    time5m: ViewTruncation;
  };
  knownInformationOmissions: KnownInformationOmission[];
}
