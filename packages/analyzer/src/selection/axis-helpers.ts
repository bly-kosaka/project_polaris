import type { CountMap } from '../aggregation/types.js';

export function sumStatusClass(distribution: CountMap<number>, from: number, to: number): number | undefined {
  const total = distribution
    .filter((entry) => entry.key >= from && entry.key <= to)
    .reduce((sum, entry) => sum + entry.count, 0);
  return total === 0 ? undefined : total;
}

export function countOf(distribution: CountMap<string>, key: string): number | undefined {
  const entry = distribution.find((e) => e.key === key);
  return entry === undefined || entry.count === 0 ? undefined : entry.count;
}
