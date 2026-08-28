import type { ResponseSizeSummary } from './types.js';

/**
 * Incremental min/max/total/average tracker. A missing responseBytes is
 * simply not recorded — never treated as 0 (04_Analyzer_Architecture.md §11).
 */
export class ResponseSizeAccumulator {
  private count = 0;
  private total = 0;
  private min: number | null = null;
  private max: number | null = null;

  add(bytes: number): void {
    this.count += 1;
    this.total += bytes;
    this.min = this.min === null ? bytes : Math.min(this.min, bytes);
    this.max = this.max === null ? bytes : Math.max(this.max, bytes);
  }

  build(): ResponseSizeSummary {
    return {
      count: this.count,
      total: this.total,
      min: this.min,
      max: this.max,
      average: this.count === 0 ? null : this.total / this.count,
    };
  }
}
