import { randomUUID } from 'node:crypto';

/**
 * Never derived from the original file name, client name, or domain —
 * an Object Key must not let anyone guess what's inside it just by reading
 * it (34_Development_Setup_and_Fourth_Sprint.md §15/§21).
 */
export function buildRawLogStorageKey(analysisId: string): string {
  return `raw-logs/${analysisId}/${randomUUID()}`;
}
