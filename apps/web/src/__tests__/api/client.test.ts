import { describe, expect, it, vi, afterEach } from 'vitest';
import { apiFetch, ApiError } from '../../api/client';

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
});
