export type KnownInformationSource = 'built_in' | 'project' | 'user';
export type KnownInformationMatchType = 'exact' | 'prefix';

/** Matches 28_Development_Setup_and_Second_Sprint.md §20 exactly — no severity/priority/risk/urgency ever. */
export interface KnownInformationEntry {
  id: string;
  target: 'path';
  source: KnownInformationSource;
  matchType: KnownInformationMatchType;
  pattern: string;
  title: string;
  description?: string;
}

export interface KnownInformationMatch {
  id: string;
  title: string;
  description?: string;
  source: KnownInformationSource;
  isPrimary: boolean;
}

/** "Priority Resolution" means which source wins a naming conflict — not a security priority (28 §20). */
export const KNOWN_INFORMATION_SOURCE_PRIORITY: Record<KnownInformationSource, number> = {
  user: 0,
  project: 1,
  built_in: 2,
};
