/**
 * @fileoverview Creating an account remembers where you were headed.
 *
 * Rule (Ed, 2026-11-19): a visitor who taps Start Application, then chooses
 * Create account instead of Sign in, lands on the application once the new
 * account is ready — not on the default page. The path is carried as
 * `?redirect`:
 *   Register  → the confirmation email link and Google / Facebook return there
 *   Register  ↔ Login links keep it
 *   Login     → its Register link keeps it
 *   Complete Profile (a brand-new account has no profile yet) → goes there
 *     after the profile is saved
 * Unsafe values (another site) are dropped — the open-redirect guard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserContext } from '@/context/UserContext';

const signUp = vi.fn();
const signInWithOAuth = vi.fn();
vi.mock('../supabaseClient', () => ({
  supabase: { auth: { signUp: (...a: unknown[]) => signUp(...a), signInWithOAuth: (...a: unknown[]) => signInWithOAuth(...a), resend: vi.fn() } },
}));
vi.mock('../config/featureFlags', () => ({ PASSWORDLESS_SIGN_IN_ENABLED: false }));

// Complete Profile: capture where the submission hook was told to go.
const submissionArgs = vi.fn();
vi.mock('@/profile/complete/useShortProfileSubmission', () => ({
  useShortProfileSubmission: (args: unknown) => {
    submissionArgs(args);
    return { handleSubmit: vi.fn() };
  },
}));

import { Register } from './Register';
import { Login } from './Login';
import { CompleteProfileForm } from '@/profile/complete/CompleteProfileForm';

const APP = '/league-operator-application';
const ORIGIN = window.location.origin;

function renderAt(route: string, ui: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <UserContext.Provider
        value={{ isLoggedIn: false, user: null, loading: false, logout: () => {}, setUser: () => {}, setIsLoggedIn: () => {} }}
      >
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </UserContext.Provider>
    </QueryClientProvider>,
  );
}

async function submitRegister() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'secret123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Register' }));
  await waitFor(() => expect(signUp).toHaveBeenCalled());
}

beforeEach(() => {
  signUp.mockReset().mockResolvedValue({ data: { user: null }, error: null });
  signInWithOAuth.mockReset().mockResolvedValue({ error: null });
  submissionArgs.mockReset();
});

describe('Register remembers ?redirect', () => {
  it('the confirmation email link returns to the page they were headed to', async () => {
    renderAt(`/register?redirect=${encodeURIComponent(APP)}`, <Register />);
    await submitRegister();
    expect(signUp.mock.calls[0][0].options.emailRedirectTo).toBe(`${ORIGIN}${APP}`);
  });

  it('Google sign-up returns there too', async () => {
    renderAt(`/register?redirect=${encodeURIComponent(APP)}`, <Register />);
    fireEvent.click(screen.getByRole('button', { name: /google/i }));
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled());
    expect(signInWithOAuth.mock.calls[0][0].options.redirectTo).toBe(`${ORIGIN}${APP}`);
  });

  it('no redirect → the home page, as before', async () => {
    renderAt('/register', <Register />);
    await submitRegister();
    expect(signUp.mock.calls[0][0].options.emailRedirectTo).toBe(`${ORIGIN}/`);
  });

  it('an unsafe redirect (another site) is dropped', async () => {
    renderAt(`/register?redirect=${encodeURIComponent('//evil.example')}`, <Register />);
    await submitRegister();
    expect(signUp.mock.calls[0][0].options.emailRedirectTo).toBe(`${ORIGIN}/`);
  });

  it('its link to Login keeps the destination', () => {
    renderAt(`/register?redirect=${encodeURIComponent(APP)}`, <Register />);
    expect(screen.getByRole('link', { name: /already have an account/i }))
      .toHaveAttribute('href', `/login?redirect=${encodeURIComponent(APP)}`);
  });
});

describe('Login → Register keeps ?redirect', () => {
  it('the Register link carries the destination', () => {
    renderAt(`/login?redirect=${encodeURIComponent(APP)}`, <Login />);
    expect(screen.getByRole('link', { name: 'Register' }))
      .toHaveAttribute('href', `/register?redirect=${encodeURIComponent(APP)}`);
  });

  it('with no destination it is a plain Register link', () => {
    renderAt('/login', <Login />);
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
  });
});

describe('Complete Profile honors ?redirect', () => {
  it('after the profile is saved it goes where the new member was headed', () => {
    renderAt(`/complete-profile?redirect=${encodeURIComponent(APP)}`, <CompleteProfileForm />);
    expect(submissionArgs.mock.calls.at(-1)?.[0]).toMatchObject({ redirectTo: APP });
  });

  it('an explicit redirectTo prop (join flow) still wins', () => {
    renderAt(`/complete-profile?redirect=${encodeURIComponent(APP)}`, <CompleteProfileForm redirectTo="/join/abc" />);
    expect(submissionArgs.mock.calls.at(-1)?.[0]).toMatchObject({ redirectTo: '/join/abc' });
  });
});
