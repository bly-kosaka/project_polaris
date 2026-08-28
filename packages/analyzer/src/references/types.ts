export interface ObservationReference {
  groupId: string;
  groupType: 'path' | 'source_ip';
}

export interface ObservationReferenceSummary {
  resolvedPathRefs: number;
  resolvedSourceIpRefs: number;
  unresolvedPathRefs: number;
  unresolvedSourceIpRefs: number;
}
