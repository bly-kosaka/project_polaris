import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readLines } from '../streaming/read-lines.js';
import { collectParsedEntries } from '../parse-access-log.js';
import { deriveAnalyzerStatus } from '../summary/derive-analyzer-status.js';

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../fixtures/access-logs',
);

function fixture(name: string): string {
  return path.join(fixturesDir, name);
}

describe('valid.log', () => {
  it('parses every line and reports success', async () => {
    const { summary } = await collectParsedEntries(readLines(fixture('valid.log')));
    expect(summary).toEqual({
      totalLines: 8,
      parsedLines: 8,
      partialLines: 0,
      failedLines: 0,
      warnings: [],
    });
    expect(deriveAnalyzerStatus(summary)).toBe('success');
  });
});

describe('partial.log', () => {
  it('keeps usable entries while surfacing field-level warnings', async () => {
    const { summary, entries } = await collectParsedEntries(readLines(fixture('partial.log')));
    expect(summary.totalLines).toBe(5);
    expect(summary.parsedLines).toBe(2);
    expect(summary.partialLines).toBe(3);
    expect(summary.failedLines).toBe(0);
    expect(summary.warnings.map((w) => w.code).sort()).toEqual([
      'INVALID_STATUS',
      'INVALID_TIMESTAMP',
      'MALFORMED_REQUEST_LINE',
    ]);
    // partial lines still contribute a usable entry, not just a warning
    expect(entries).toHaveLength(5);
    expect(deriveAnalyzerStatus(summary)).toBe('partial');
  });
});

describe('invalid.log', () => {
  it('produces zero usable lines and is fatal', async () => {
    const { summary } = await collectParsedEntries(readLines(fixture('invalid.log')));
    expect(summary.totalLines).toBe(3);
    expect(summary.parsedLines).toBe(0);
    expect(summary.partialLines).toBe(0);
    expect(summary.failedLines).toBe(3);
    expect(deriveAnalyzerStatus(summary)).toBe('failed');
  });
});

describe('mixed.log', () => {
  it('is analyzable overall despite some unparseable lines', async () => {
    const { summary } = await collectParsedEntries(readLines(fixture('mixed.log')));
    expect(summary.totalLines).toBe(7);
    expect(summary.parsedLines).toBe(4);
    expect(summary.failedLines).toBe(3);
    expect(deriveAnalyzerStatus(summary)).toBe('partial');
  });
});
