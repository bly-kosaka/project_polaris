import type { RedactionSummary } from './types.js';

export class RedactionSummaryBuilder {
  private readonly appliedParameterNames = new Set<string>();
  private redactedQuerySampleCount = 0;
  private redactedReferrerSampleCount = 0;
  private droppedQuerySampleCount = 0;
  private droppedReferrerSampleCount = 0;

  recordQuery(redactedParameterNames: string[]): void {
    if (redactedParameterNames.length > 0) {
      this.redactedQuerySampleCount += 1;
      for (const name of redactedParameterNames) this.appliedParameterNames.add(name);
    }
  }

  recordQueryDropped(): void {
    this.droppedQuerySampleCount += 1;
  }

  recordReferrer(redactedParameterNames: string[]): void {
    if (redactedParameterNames.length > 0) {
      this.redactedReferrerSampleCount += 1;
      for (const name of redactedParameterNames) this.appliedParameterNames.add(name);
    }
  }

  recordReferrerDropped(): void {
    this.droppedReferrerSampleCount += 1;
  }

  build(): RedactionSummary {
    return {
      appliedParameterNames: Array.from(this.appliedParameterNames).sort(),
      redactedQuerySampleCount: this.redactedQuerySampleCount,
      redactedReferrerSampleCount: this.redactedReferrerSampleCount,
      droppedQuerySampleCount: this.droppedQuerySampleCount,
      droppedReferrerSampleCount: this.droppedReferrerSampleCount,
    };
  }
}
