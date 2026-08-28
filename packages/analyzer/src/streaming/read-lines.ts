import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

/**
 * Yields one line at a time via `readline` over a file stream — the file is
 * never buffered whole in memory, however large it is (18_MVP_System_Architecture.md #22).
 */
export async function* readLines(filePath: string): AsyncGenerator<string> {
  const stream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      yield line;
    }
  } finally {
    rl.close();
    stream.close();
  }
}
