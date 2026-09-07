import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockVerifyToken, mockGetUser } = vi.hoisted(() => ({
  mockVerifyToken: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock('@clerk/backend', () => {
  class MockClerkClient {
    users = { getUser: mockGetUser };
  }
  return {
    verifyToken: mockVerifyToken,
    createClerkClient: () => new MockClerkClient(),
  };
});

vi.mock('@clerk/backend/errors', () => {
  class TokenVerificationError extends Error {
    reason: string;
    constructor({ message, reason }: { message: string; reason: string }) {
      super(message);
      this.name = 'TokenVerificationError';
      this.reason = reason;
    }
  }
  // Exact string values confirmed against the installed @clerk/backend's own
  // compiled output (packages/auth's ClerkAuthAdapter implementation notes).
  const TokenVerificationErrorReason = {
    TokenExpired: 'token-expired',
    TokenInvalid: 'token-invalid',
    TokenInvalidAlgorithm: 'token-invalid-algorithm',
    TokenInvalidAuthorizedParties: 'token-invalid-authorized-parties',
    TokenInvalidSignature: 'token-invalid-signature',
    TokenNotActiveYet: 'token-not-active-yet',
    TokenIatInTheFuture: 'token-iat-in-the-future',
    TokenVerificationFailed: 'token-verification-failed',
    InvalidSecretKey: 'secret-key-invalid',
    LocalJWKMissing: 'jwk-local-missing',
    RemoteJWKFailedToLoad: 'jwk-remote-failed-to-load',
    RemoteJWKInvalid: 'jwk-remote-invalid',
    RemoteJWKMissing: 'jwk-remote-missing',
    JWKFailedToResolve: 'jwk-failed-to-resolve',
    JWKKidMismatch: 'jwk-kid-mismatch',
  };
  return { TokenVerificationError, TokenVerificationErrorReason };
});

const { ClerkAuthAdapter } = await import('../clerk/clerk-auth-adapter.js');
const { TokenVerificationError, TokenVerificationErrorReason } = await import('@clerk/backend/errors');

function adapter(): InstanceType<typeof ClerkAuthAdapter> {
  return new ClerkAuthAdapter({ secretKey: 'sk_test', authorizedParties: ['http://localhost:5173'] });
}

describe('ClerkAuthAdapter', () => {
  afterEach(() => {
    mockVerifyToken.mockReset();
    mockGetUser.mockReset();
  });

  it('returns an AuthenticatedPrincipal from session claims when email/email_verified are present, without calling getUser', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'user_123', sid: 'sess_abc', email: 'a@example.com', email_verified: true });
    const result = await adapter().verifyToken('tok');
    expect(result).toEqual({ provider: 'clerk', subject: 'user_123', email: 'a@example.com', emailVerified: true });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('m-01: falls back to users.getUser() and the primary EmailAddress when email claims are absent', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'user_123', sid: 'sess_abc' });
    mockGetUser.mockResolvedValue({
      primaryEmailAddressId: 'ea_1',
      emailAddresses: [
        { id: 'ea_0', emailAddress: 'not-primary@example.com', verification: { status: 'verified' } },
        { id: 'ea_1', emailAddress: 'b@example.com', verification: { status: 'verified' } },
      ],
    });
    const result = await adapter().verifyToken('tok');
    expect(result).toEqual({ provider: 'clerk', subject: 'user_123', email: 'b@example.com', emailVerified: true });
  });

  it('m-01: emailVerified is false when the primary EmailAddress is not verified', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'user_123', sid: 'sess_abc' });
    mockGetUser.mockResolvedValue({
      primaryEmailAddressId: 'ea_1',
      emailAddresses: [{ id: 'ea_1', emailAddress: 'b@example.com', verification: { status: 'unverified' } }],
    });
    const result = await adapter().verifyToken('tok');
    expect(result.emailVerified).toBe(false);
  });

  it('T-AUTH-12b (F-06): a successfully-verified token with no sid claim is rejected as AUTHENTICATION_INVALID', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'user_123' }); // no sid — not session-bound
    await expect(adapter().verifyToken('tok')).rejects.toMatchObject({ name: 'AuthError', code: 'AUTHENTICATION_INVALID' });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('T-AUTH-12a: authorizedParties mismatch classifies as AUTHENTICATION_INVALID', async () => {
    mockVerifyToken.mockRejectedValue(
      new TokenVerificationError({ message: 'authorized party mismatch', reason: TokenVerificationErrorReason.TokenInvalidAuthorizedParties }),
    );
    await expect(adapter().verifyToken('tok')).rejects.toMatchObject({ code: 'AUTHENTICATION_INVALID' });
  });

  it.each([
    TokenVerificationErrorReason.TokenExpired,
    TokenVerificationErrorReason.TokenInvalid,
    TokenVerificationErrorReason.TokenInvalidAlgorithm,
    TokenVerificationErrorReason.TokenInvalidSignature,
    TokenVerificationErrorReason.TokenNotActiveYet,
    TokenVerificationErrorReason.TokenIatInTheFuture,
    TokenVerificationErrorReason.TokenVerificationFailed,
  ])('classifies verifyToken reason %s as AUTHENTICATION_INVALID', async (reason) => {
    mockVerifyToken.mockRejectedValue(new TokenVerificationError({ message: 'bad token', reason }));
    await expect(adapter().verifyToken('tok')).rejects.toMatchObject({ code: 'AUTHENTICATION_INVALID' });
  });

  it.each([
    TokenVerificationErrorReason.LocalJWKMissing,
    TokenVerificationErrorReason.RemoteJWKFailedToLoad,
    TokenVerificationErrorReason.RemoteJWKInvalid,
    TokenVerificationErrorReason.RemoteJWKMissing,
    TokenVerificationErrorReason.JWKFailedToResolve,
    TokenVerificationErrorReason.JWKKidMismatch,
    TokenVerificationErrorReason.InvalidSecretKey,
  ])('F-02: classifies verifyToken reason %s as AUTHENTICATION_UNAVAILABLE', async (reason) => {
    mockVerifyToken.mockRejectedValue(new TokenVerificationError({ message: 'jwks unreachable', reason }));
    await expect(adapter().verifyToken('tok')).rejects.toMatchObject({ code: 'AUTHENTICATION_UNAVAILABLE' });
  });

  it('classifies an unrecognized verifyToken error as AUTHENTICATION_UNAVAILABLE, never a silent throw', async () => {
    mockVerifyToken.mockRejectedValue(new Error('mystery network failure'));
    await expect(adapter().verifyToken('tok')).rejects.toMatchObject({ code: 'AUTHENTICATION_UNAVAILABLE' });
  });

  it('T-AUTH-15 (F-08): a users.getUser() failure after a valid token classifies as AUTHENTICATION_UNAVAILABLE, never AUTHENTICATION_INVALID', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'user_123', sid: 'sess_abc' }); // no email claims -> triggers getUser fallback
    mockGetUser.mockRejectedValue(new Error('ETIMEDOUT'));
    await expect(adapter().verifyToken('tok')).rejects.toMatchObject({ code: 'AUTHENTICATION_UNAVAILABLE' });
  });
});
