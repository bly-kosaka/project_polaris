import type { AnalysisStatus } from '@polaris/domain';
import { DbError } from './errors.js';

/**
 * Minimal, hand-written transition guard — not a full state machine.
 * created -> analyzer_result_ready directly is rejected (31 §31's own
 * example of a transition that must not be allowed unconditionally).
 * Any state can move to 'failed'. `failed` is terminal. `completed` may
 * re-enter `explaining` only for an AI Explanation retry
 * (44_Development_Setup_and_Sixth_Sprint.md §9, 46_Sprint_6_Plan_Final_Review.md
 * §6) — the top-level Analyzer result itself is never re-run; only
 * `aiStatus` cycles back through `queued -> running -> success | failed`.
 */
const ALLOWED_ANALYSIS_TRANSITIONS: Record<AnalysisStatus, AnalysisStatus[]> = {
  created: ['uploaded', 'failed'],
  uploaded: ['analyzing', 'failed'],
  analyzing: ['analyzer_result_ready', 'failed'],
  analyzer_result_ready: ['explaining', 'completed', 'failed'],
  explaining: ['completed', 'failed'],
  completed: ['explaining'],
  failed: [],
};

export function assertValidAnalysisStatusTransition(from: AnalysisStatus, to: AnalysisStatus): void {
  if (from === to) return;
  if (!ALLOWED_ANALYSIS_TRANSITIONS[from].includes(to)) {
    throw new DbError('INVALID_DATA', `Invalid Analysis status transition: ${from} -> ${to}`);
  }
}
