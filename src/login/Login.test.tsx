/**
 * @fileoverview Tests for the one-door sign-in screen (passwordless mode).
 *
 * Forces the passwordless flag on and mocks the auth helpers + supabase client
 * so the screen's behaviour is asserted in isolation: the choose view renders,
 * requesting a code advances to the code step, the password reveal works, and a
 * send failure surfaces an error.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import { Login } from './Login';
import { requestEmailCode } from './passwordlessAuth';

vi.mock('../config/featureFlags', () => ({ PASSWORDLESS_SIGN_IN_ENABLED: true }));
vi.mock('../supabaseClient', () => ({
  supabase: { auth: { signInWithOAuth: vi.fn(), signInWithPassword: vi.fn() } },
}));
vi.mock('./passwordlessAuth', () => ({
  requestEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
}));

const mockedRequestEmailCode = requestEmailCode as unknown as ReturnType<typeof vi.fn>;

const renderSignedOut = () =>
  renderWithProviders(<Login />, { userContext: { isLoggedIn: false, user: null } });

describe('Login (one-door, passwordless)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the passwordless choose view', () => {
    renderSignedOut();

    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /email me a code/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prefer a password/i })).toBeInTheDocument();
  });

  it('requesting a code calls requestEmailCode and advances to the code step', async () => {
    mockedRequestEmailCode.mockResolvedValue(undefined);
    renderSignedOut();

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'player@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /email me a code/i }));

    await waitFor(() =>
      expect(mockedRequestEmailCode).toHaveBeenCalledWith('player@example.com'),
    );
    // Now on the code step.
    expect(await screen.findByLabelText('Enter the code')).toBeInTheDocument();
    expect(screen.getByText(/player@example.com/)).toBeInTheDocument();
  });

  it('"prefer a password?" reveals the password form', () => {
    renderSignedOut();

    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /prefer a password/i }));

    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with password/i })).toBeInTheDocument();
  });

  it('surfaces an error and stays on the choose step when sending fails', async () => {
    mockedRequestEmailCode.mockRejectedValue(new Error('email rate limit exceeded'));
    renderSignedOut();

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'player@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /email me a code/i }));

    expect(await screen.findByText(/email rate limit exceeded/i)).toBeInTheDocument();
    // Still on the choose step (code input not shown).
    expect(screen.queryByLabelText('Enter the code')).not.toBeInTheDocument();
  });
});
