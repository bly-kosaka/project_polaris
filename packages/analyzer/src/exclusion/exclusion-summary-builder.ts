import type { ExclusionSummary } from './types.js';

export class ExclusionSummaryBuilder {
  private excludedEntryCount = 0;
  private readonly countsByRuleId = new Map<string, number>();

  add(ruleId: string): void {
    this.excludedEntryCount += 1;
    this.countsByRuleId.set(ruleId, (this.countsByRuleId.get(ruleId) ?? 0) + 1);
  }

  build(): ExclusionSummary {
    if (this.excludedEntryCount === 0) {
      return { excludedEntryCount: 0 };
    }
    return {
      excludedEntryCount: this.excludedEntryCount,
      byReason: Array.from(this.countsByRuleId.entries())
        .map(([ruleId, count]) => ({ ruleId, count }))
        .sort((a, b) => b.count - a.count || (a.ruleId < b.ruleId ? -1 : 1)),
    };
  }
}
