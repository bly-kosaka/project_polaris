/**
 * The one exact/prefix path-matching primitive, shared by exclusion/ and
 * known-information/. Deliberately path-only — Source IP matching is exact
 * string equality, not a pattern matcher, so it never routes through here
 * (29_Sprint_2_Implementation_Plan_Final_Addendum.md #12).
 */
export function matchesExact(path: string, pattern: string): boolean {
  return path === pattern;
}

export function matchesPrefix(path: string, pattern: string): boolean {
  return path.startsWith(pattern);
}
