/**
 * A small ApiError carrying the backend's `{ error: { code, message } }`
 * contract (39_Development_Setup_and_Fifth_Sprint.md §13) — pages branch on
 * `.code`, never parse `.message` for logic. `status === 0` means the
 * request never reached the server at all (network failure).
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: BodyInit;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * A settable module-level getter rather than a Clerk import inside
 * `apiFetch` itself — keeps this file a plain, Clerk-agnostic, directly
 * testable function, and lets `apps/product-e2e` switch between Account A
 * and Account B by swapping this one function
 * (50_Development_Setup_and_Seventh_Sprint.md decision 11).
 */
let tokenGetter: (() => Promise<string | null>) | undefined;

export function setTokenGetter(fn: typeof tokenGetter): void {
  tokenGetter = fn;
}

/**
 * Same settable-callback pattern as `tokenGetter` — invoked whenever the
 * Backend itself reports the session is no longer usable
 * (`AUTHENTICATION_REQUIRED` / `AUTHENTICATION_INVALID`), so a page that's
 * already mounted can recover (e.g. redirect to Sign In) even without a
 * new Navigation ever happening. Deliberately never invoked for
 * `AUTHENTICATION_UNAVAILABLE` (503) — an Auth Provider outage must never
 * look like a bad session (55_Sprint_7_Independent_Review.md M-01).
 */
let authenticationFailureHandler: ((error: ApiError) => void | Promise<void>) | undefined;

export function setAuthenticationFailureHandler(fn: typeof authenticationFailureHandler): void {
  authenticationFailureHandler = fn;
}

function isApiErrorBody(value: unknown): value is { error: { code: string; message: string } } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as { error: unknown }).error === 'object' &&
    (value as { error: { code?: unknown } }).error !== null &&
    typeof (value as { error: { code?: unknown } }).error.code === 'string' &&
    typeof (value as { error: { message?: unknown } }).error.message === 'string'
  );
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  // Merged in without clobbering any caller-supplied headers (e.g. the
  // FormData upload's deliberate absence of a content-type header) — never
  // set at all when there's no token getter installed yet or it returns
  // null (F-07: a request fired before Clerk finishes loading must never
  // silently look authenticated with a stale/missing token).
  const token = tokenGetter ? await tokenGetter() : null;
  const headers: Record<string, string> = { ...options.headers };
  if (token !== null) {
    headers.authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      ...(options.body !== undefined ? { body: options.body } : {}),
      headers,
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Failed to reach the server');
  }

  if (!response.ok) {
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      throw new ApiError(response.status, 'UNEXPECTED_RESPONSE', `Request failed with status ${response.status}`);
    }
    if (isApiErrorBody(parsed)) {
      const apiError = new ApiError(response.status, parsed.error.code, parsed.error.message);
      if (apiError.code === 'AUTHENTICATION_REQUIRED' || apiError.code === 'AUTHENTICATION_INVALID') {
        void authenticationFailureHandler?.(apiError);
      }
      throw apiError;
    }
    throw new ApiError(response.status, 'UNEXPECTED_RESPONSE', `Request failed with status ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
