import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  type NotFound,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { mapStorageError } from './errors.js';
import type { PutObjectParams, TemporaryObjectStorage } from './temporary-object-storage.js';

export class S3TemporaryObjectStorage implements TemporaryObjectStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async putObject(params: PutObjectParams): Promise<void> {
    try {
      // Streams the body in multipart chunks — never buffers the whole
      // object in memory (34_Development_Setup_and_Fourth_Sprint.md §31).
      // leavePartsOnError defaults to false, so an aborted source stream
      // cleans up its in-progress multipart upload automatically.
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: params.key,
          Body: params.body,
          ...(params.contentType !== undefined ? { ContentType: params.contentType } : {}),
        },
      });
      await upload.done();
    } catch (error) {
      throw mapStorageError(error);
    }
  }

  async getObjectStream(key: string): Promise<Readable> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (result.Body === undefined) {
        throw new Error(`Object body was empty for key ${key}`);
      }
      return result.Body as unknown as Readable;
    } catch (error) {
      throw mapStorageError(error);
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      // DeleteObject is idempotent by nature in S3-compatible storage — a
      // missing key still returns a success response, never a 404
      // (34_Development_Setup_and_Fourth_Sprint.md §37).
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      throw mapStorageError(error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw mapStorageError(error);
    }
  }
}

function isNotFound(error: unknown): error is NotFound {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('name' in error ? (error as { name?: string }).name === 'NotFound' : false)
  );
}
