import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';

/**
 * `readline.Interface` reads and yields one line at a time as the
 * underlying stream produces bytes — never buffers the whole Raw Log into
 * memory first (34_Development_Setup_and_Fourth_Sprint.md §31).
 */
export function linesFromStream(stream: Readable): AsyncIterable<string> {
  return createInterface({ input: stream, crlfDelay: Infinity });
}
