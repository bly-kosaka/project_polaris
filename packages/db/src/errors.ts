export type DbErrorCode = 'NOT_FOUND' | 'CONFLICT' | 'INVALID_DATA' | 'PERSISTENCE_FAILED';

export class DbError extends Error {
  readonly code: DbErrorCode;

  constructor(code: DbErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DbError';
    this.code = code;
  }
}

interface PrismaKnownRequestErrorLike {
  code: string;
}

function isPrismaKnownRequestError(error: unknown): error is PrismaKnownRequestErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

/**
 * Never leaks the raw Prisma error message or query metadata — only a
 * small classified code crosses this boundary (31_Development_Setup_and_Third_Sprint.md §42).
 */
export function mapPrismaError(error: unknown): DbError {
  if (isPrismaKnownRequestError(error)) {
    switch (error.code) {
      case 'P2002':
        return new DbError('CONFLICT', 'A unique constraint was violated', { cause: error });
      case 'P2025':
        return new DbError('NOT_FOUND', 'The requested record was not found', { cause: error });
      case 'P2003':
        return new DbError('INVALID_DATA', 'A foreign key constraint was violated', { cause: error });
      default:
        return new DbError('PERSISTENCE_FAILED', 'A database operation failed', { cause: error });
    }
  }
  return new DbError('PERSISTENCE_FAILED', 'A database operation failed', { cause: error });
}
