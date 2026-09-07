import { describe, expect, it, vi, afterEach } from 'vitest';
import { apiFetch, ApiError, setTokenGetter } from '../../api/client';

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setTokenGetter(undefined);
  });

  it('returns parsed JSON on a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ hello: 'world' }), { status: 200 })),
    );

    const result = await apiFetch<{ hello: string }>('/anything');
    expect(result).toEqual({ hello: 'world' });
  });

  it('throws ApiError with the code/message from the { error } contract on a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'PROJECT_NOT_FOUND', message: 'not found' } }), {
          status: 404,
        }),
      ),
    );

    await expect(apiFetch('/projects/x')).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
      status: 404,
      message: 'not found',
    });
  });

  it('throws a NETWORK_ERROR ApiError with status 0 when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));

    const error = await apiFetch('/anything').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('NETWORK_ERROR');
    expect((error as ApiError).status).toBe(0);
  });

  it('falls back to UNEXPECTED_RESPONSE when the error body does not match the contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 500 })));

    const error = await apiFetch('/anything').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('UNEXPECTED_RESPONSE');
  });

  it('injects an Authorization header from the installed token getter (F-07/decision 11)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    setTokenGetter(() => Promise.resolve('a-real-token'));

    await apiFetch('/projects');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer a-real-token');
  });

  it('sends no Authorization header when no token getter is installed yet', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/projects');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('sends no Authorization header when the token getter resolves null', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    setTokenGetter(() => Promise.resolve(null));

    await apiFetch('/projects');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('a 503 AUTHENTICATION_UNAVAILABLE surfaces as a normal ApiError — apiFetch itself never signs the user out (F-02)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: 'AUTHENTICATION_UNAVAILABLE', message: 'Auth Provider unavailable' } }),
          { status: 503 },
        ),
      ),
    );

    const error = await apiFetch('/projects').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('AUTHENTICATION_UNAVAILABLE');
    expect((error as ApiError).status).toBe(503);
  });
});
