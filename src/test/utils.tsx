/**
 * @fileoverview Test utilities
 * Custom render functions and helpers for testing React components
 */
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserContext } from '@/context/UserContext';
import type { UserContextType } from '@/context/UserContext';
import type { User } from '@supabase/supabase-js';
import { DOUBLE_TAP_WINDOW_MS } from '@/components/ui/button';

/**
 * Custom render function that wraps components with necessary providers
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Mock user context
  userContext?: Partial<UserContextType>;
  // Initial route for react-router
  initialRoute?: string;
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: CustomRenderOptions
) {
  const { userContext, initialRoute = '/', ...renderOptions } = options || {};

  // Default mock user
  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };

  // Default user context
  const defaultUserContext: UserContextType = {
    isLoggedIn: true,
    user: mockUser,
    loading: false,
    logout: () => {},
    setUser: () => {},
    setIsLoggedIn: () => {},
    ...userContext,
  };

  // Set initial route
  if (initialRoute !== '/') {
    window.history.pushState({}, 'Test page', initialRoute);
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <UserContext.Provider value={defaultUserContext}>
          <BrowserRouter>{children}</BrowserRouter>
        </UserContext.Provider>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Wait the way a person does between two taps on the same button.
 *
 * Every Button ignores a second tap that lands within DOUBLE_TAP_WINDOW_MS of
 * the first (the double-tap lock). A test that taps the same spot twice on
 * purpose (Review, then Confirm in the same place; Add, then Add again) calls
 * this between the taps. A real wait, not fake timers, so nothing else in the
 * test changes.
 *
 * @returns A promise that resolves once the lock has passed.
 */
export function pauseBetweenTaps(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, DOUBLE_TAP_WINDOW_MS + 10));
}

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';
