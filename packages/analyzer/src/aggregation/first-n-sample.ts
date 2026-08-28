/**
 * Keeps the first N DISTINCT values encountered, in arrival order. This is a
 * plain "first-N sample" (28_Development_Setup_and_Second_Sprint.md §30.1
 * Option A) — deliberately NOT a frequency ranking. A bounded structure that
 * stops admitting new keys once full would misrepresent a value that only
 * starts recurring after the cap fills as if it never occurred at all; this
 * type carries no count field, so nothing downstream can mistake it for one.
 * Arrival order is itself deterministic, since entries are consumed in a
 * fixed line order.
 */
export class FirstNSample<T> {
  private readonly seen = new Set<T>();

  constructor(private readonly limit: number) {}

  add(value: T): void {
    if (this.seen.size >= this.limit) return;
    this.seen.add(value);
  }

  values(): T[] {
    return Array.from(this.seen);
  }
}
