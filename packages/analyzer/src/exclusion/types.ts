/**
 * Discriminated union so `{ target: 'source_ip', matchType: 'prefix' }` is a
 * compile-time error — Source IP exclusion is exact-only in Sprint 2, no CIDR
 * (29_Sprint_2_Implementation_Plan_Final_Addendum.md F-02).
 */
export type ExclusionRule =
  | { id: string; target: 'path'; matchType: 'exact' | 'prefix'; value: string }
  | { id: string; target: 'source_ip'; matchType: 'exact'; value: string };

export interface ExclusionConfig {
  rules: ExclusionRule[];
}

export interface ExclusionSummary {
  excludedEntryCount: number;
  byReason?: Array<{ ruleId: string; count: number }>;
}
