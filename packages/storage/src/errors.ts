export type StorageErrorCode = 'NOT_FOUND' | 'TRANSIENT' | 'PERMANENT';

export class StorageError extends Error {
  readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StorageError';
    this.code = code;
  }
}

interface AwsErrorLike {
  name?: string;
  Code?: string;
  $metadata?: { httpStatusCode?: number };
}

function isAwsErrorLike(error: unknown): error is AwsErrorLike {
  return typeof error === 'object' && error !== null;
}

/**
 * Classifies a raw AWS SDK error into a small, stable code — never leaks
 * the raw SDK error message/metadata past this boundary (mirrors
 * packages/db/src/errors.ts's mapPrismaError pattern).
 */
export function mapStorageError(error: unknown): StorageError {
  if (isAwsErrorLike(error)) {
    const status = error.$metadata?.httpStatusCode;
    if (error.name === 'NoSuchKey' || error.name === 'NotFound' || status === 404) {
      return new StorageError('NOT_FOUND', 'The requested object was not found', { cause: error });
    }
    if (status !== undefined && status >= 500) {
      return new StorageError('TRANSIENT', 'A transient storage error occurred', { cause: error });
    }
    if (error.name === 'TimeoutError' || error.name === 'NetworkingError') {
      return new StorageError('TRANSIENT', 'A transient storage error occurred', { cause: error });
    }
  }
  return new StorageError('PERMANENT', 'A storage operation failed', { cause: error });
}
