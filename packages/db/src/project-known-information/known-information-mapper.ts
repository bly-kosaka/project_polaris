import type { KnownInformationEntry } from '@polaris/analyzer';
import type { ProjectKnownInformation } from './types.js';

/**
 * `listByProjectId` intentionally returns disabled rows too — filtering
 * happens here, the only path to KnownInformationEntry[], so a disabled
 * row is structurally incapable of reaching the Analyzer input.
 */
export function toKnownInformationEntry(record: ProjectKnownInformation): KnownInformationEntry {
  return {
    id: record.id,
    target: 'path',
    source: 'project',
    matchType: record.matchType,
    pattern: record.pattern,
    title: record.title,
    ...(record.description !== undefined ? { description: record.description } : {}),
  };
}

export function toKnownInformationDataset(records: ProjectKnownInformation[]): KnownInformationEntry[] {
  return records.filter((record) => record.enabled).map(toKnownInformationEntry);
}
