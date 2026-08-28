/**
 * referrerDistribution is host-only, never a raw query-bearing referrer URL
 * (08_Detection_Rules.md §21.4) — full referrer values only appear in the
 * capped, later-redacted sample list.
 */
export function extractReferrerHost(referrer: string): string {
  try {
    return new URL(referrer).host || '(unknown)';
  } catch {
    return '(unparsable)';
  }
}
