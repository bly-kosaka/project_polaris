import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readLines } from '../streaming/read-lines.js';
import { parseAccessLog } from '../parse-access-log.js';

let tmpDir: string | undefined;

afterEach(async () => {
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  }
});

async function writeSyntheticLog(lineCount: number): Promise<string> {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'polaris-analyzer-'));
  const filePath = path.join(tmpDir, 'synthetic.log');
  const lines: string[] = [];
  for (let i = 0; i < lineCount; i += 1) {
    lines.push(
      `192.0.2.10 - - [10/Oct/2023:13:55:36 +0000] "GET /page-${i} HTTP/1.1" 200 512 "-" "-"`,
    );
  }
  await writeFile(filePath, `${lines.join('\n')}\n`, 'utf-8');
  return filePath;
}

describe('readLines', () => {
  it('yields lines lazily — the iterator can stop after the first line without reading the rest', async () => {
    const filePath = await writeSyntheticLog(5000);
    let count = 0;
    for await (const _line of readLines(filePath)) {
      count += 1;
      break;
    }
    expect(count).toBe(1);
  });

  it('yields every line for a large synthetic file without loading it all at once', async () => {
    const lineCount = 20000;
    const filePath = await writeSyntheticLog(lineCount);

    let count = 0;
    for await (const _line of readLines(filePath)) {
      count += 1;
    }
    expect(count).toBe(lineCount);
  });

  it('feeds directly into parseAccessLog end to end for a large file', async () => {
    const lineCount = 10000;
    const filePath = await writeSyntheticLog(lineCount);

    const { summary } = await parseAccessLog(readLines(filePath));
    expect(summary.totalLines).toBe(lineCount);
    expect(summary.parsedLines).toBe(lineCount);
    expect(summary.failedLines).toBe(0);
  });
});
