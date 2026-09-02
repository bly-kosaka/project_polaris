import type { Readable } from 'node:stream';

export interface PutObjectParams {
  key: string;
  body: Readable;
  contentType?: string;
}

/**
 * All methods are stream-typed on the way in/out — Raw Access Log must
 * never be fully buffered in memory (34_Development_Setup_and_Fourth_Sprint.md §31).
 * `Readable` (node:stream), not the broader `NodeJS.ReadableStream`, since
 * that's what the AWS SDK v3's Node runtime actually accepts/returns for a
 * streaming body (StreamingBlobPayloadInputTypes).
 */
export interface TemporaryObjectStorage {
  putObject(params: PutObjectParams): Promise<void>;
  getObjectStream(key: string): Promise<Readable>;
  deleteObject(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
