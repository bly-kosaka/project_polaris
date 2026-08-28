import type { KnownInformationOmission, TruncationSummary, ViewTruncation } from './types.js';

export function buildTruncationSummary(
  views: TruncationSummary['views'],
  knownInformationOmissions: KnownInformationOmission[],
): TruncationSummary {
  const truncated =
    Object.values(views).some((v: ViewTruncation) => v.omittedGroups > 0) ||
    knownInformationOmissions.length > 0;
  return { truncated, views, knownInformationOmissions };
}
