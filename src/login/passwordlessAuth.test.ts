/**
 * @fileoverview Unit tests for the passwordless auth helpers.
 *
 * Establishes the `supabase.auth` mock pattern for the codebase (no prior auth
 * tests existed). Mocks the `../supabaseClient` singleton so no real Supabase
 * client is constructed and the send/verify calls are asserted in isolation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestEmailCode, verifyEmailCode } from './passwordlessAuth';
import { supabase } from '../supabaseClient';

vi.mock('../supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
    },
  },
}));

// Typed handle on the mocked auth methods for assertions.
const mockedAuth = supabase.auth as unknown as {
  signInWithOtp: ReturnType<typeof vi.fn>;
  verifyOtp: ReturnType<typeof vi.fn>;
};

describe('requestEmailCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends a code to the given email', async () => {
    mockedAuth.signInWithOtp.mockResolvedValue({ data: {}, error: null });

    await requestEmailCode('player@example.com');

    expect(mockedAuth.signInWithOtp).toHaveBeenCalledWith({
      email: 'player@example.com',
    });
  });

  it('trims surrounding whitespace before sending', async () => {
    mockedAuth.signInWithOtp.mockResolvedValue({ data: {}, error: null });

    await requestEmailCode('  player@example.com  ');

    expect(mockedAuth.signInWithOtp).toHaveBeenCalledWith({
      email: 'player@example.com',
    });
  });

  it('throws on a blank email without calling Supabase', async () => {
    await expect(requestEmailCode('   ')).rejects.toThrow(/email/i);
    expect(mockedAuth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('surfaces the Supabase error message', async () => {
    mockedAuth.signInWithOtp.mockResolvedValue({
      data: {},
      error: { message: 'email rate limit exceeded' },
    });

    await expect(requestEmailCode('player@example.com')).rejects.toThrow(
      'email rate limit exceeded',
    );
  });
});

describe('verifyEmailCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('verifies with type "email" (not the legacy "signup")', async () => {
    mockedAuth.verifyOtp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 't' } },
      error: null,
    });

    const result = await verifyEmailCode('player@example.com', '123456');

    expect(mockedAuth.verifyOtp).toHaveBeenCalledWith({
      email: 'player@example.com',
      token: '123456',
      type: 'email',
    });
    expect(result.user).toEqual({ id: 'u1' });
    expect(result.session).toEqual({ access_token: 't' });
  });

  it('trims both email and token', async () => {
    mockedAuth.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    await verifyEmailCode('  player@example.com ', ' 123456 ');

    expect(mockedAuth.verifyOtp).toHaveBeenCalledWith({
      email: 'player@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it('throws on a blank code without calling Supabase', async () => {
    await expect(verifyEmailCode('player@example.com', '  ')).rejects.toThrow(
      /code/i,
    );
    expect(mockedAuth.verifyOtp).not.toHaveBeenCalled();
  });

  it('surfaces the Supabase error (wrong/expired code)', async () => {
    mockedAuth.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Token has expired or is invalid' },
    });

    await expect(verifyEmailCode('player@example.com', '000000')).rejects.toThrow(
      /expired or is invalid/,
    );
  });
});
