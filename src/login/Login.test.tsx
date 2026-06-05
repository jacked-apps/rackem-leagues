/**
 * @fileoverview Tests for the one-door sign-in screen (passwordless mode).
 *
 * Forces the passwordless flag on and mocks the auth helpers + supabase client
 * so the screen's behaviour is asserted in isolation: the choose view renders,
 * requesting a code advances to the code step, the password reveal works, a send
 * failure surfaces an error, and the post-auth ?redirect is honored (and guarded).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserContext } from '@/context/UserContext';
import { renderWithProviders } from '../test/utils';
import { Login } from './Login';
import { requestEmailCode, verifyEmailCode } from './passwordlessAuth';

vi.mock('../config/featureFlags', () => ({ PASSWORDLESS_SIGN_IN_ENABLED: true }));
vi.mock('../supabaseClient', () => ({
  supabase: { auth: { signInWithOAuth: vi.fn(), signInWithPassword: vi.fn() } },
}));
vi.mock('./passwordlessAuth', () => ({
  requestEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
}));

const mockedRequestEmailCode = requestEmailCode as unknown as ReturnType<typeof vi.fn>;
const mockedVerifyEmailCode = verifyEmailCode as unknown as ReturnType<typeof vi.fn>;

const renderSignedOut = () =>
  renderWithProviders(<Login />, { userContext: { isLoggedIn: false, user: null } });

/** Renders the current pathname so redirect tests can assert where we landed. */
function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
}

/**
 * Render Login under a MemoryRouter at a specific route — reliable for reading
 * `?redirect` (happy-dom doesn't surface the query through BrowserRouter+pushState).
 */
function renderLoginAt(route: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UserContext.Provider
        value={{
          isLoggedIn: false,
          user: null,
          loading: false,
          logout: () => {},
          setUser: () => {},
          setIsLoggedIn: () => {},
        }}
      >
        <MemoryRouter initialEntries={[route]}>
          <Login />
          <LocationProbe />
        </MemoryRouter>
      </UserContext.Provider>
    </QueryClientProvider>,
  );
}

/** Drive the email -> code -> verify flow (assumes the request/verify mocks resolve). */
async function completeCodeFlow() {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'player@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: /email me a code/i }));
  const codeInput = await screen.findByLabelText('Enter the code');
  fireEvent.change(codeInput, { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: /verify & sign in/i }));
}

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
    expect(screen.queryByLabelText('Enter the code')).not.toBeInTheDocument();
  });

  it('lands on the ?redirect target after the code verifies', async () => {
    mockedRequestEmailCode.mockResolvedValue(undefined);
    mockedVerifyEmailCode.mockResolvedValue({ user: { id: 'u1' }, session: {} });

    renderLoginAt('/login?redirect=%2Fspectate%2F1');
    await completeCodeFlow();

    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/spectate/1'));
  });

  it('ignores an unsafe off-origin ?redirect and falls back to /my-teams', async () => {
    mockedRequestEmailCode.mockResolvedValue(undefined);
    mockedVerifyEmailCode.mockResolvedValue({ user: { id: 'u1' }, session: {} });

    renderLoginAt('/login?redirect=https%3A%2F%2Fevil.com');
    await completeCodeFlow();

    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/my-teams'));
  });
});
