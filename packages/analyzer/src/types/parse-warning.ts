/**
 * A single field-level parse issue. Never carries the raw log line —
 * only a safe, human-readable description (26_Development_Setup_and_First_Sprint.md #40).
 */
export interface ParseWarning {
  code: string;
  message: string;
  field?: string;
}
