/**
 * @fileoverview Smoke test for SeasonCreationWizard
 *
 * Purpose: Verify the wizard renders without crashing and basic UI elements are present.
 * This is a lightweight test that catches "oops, I broke the whole wizard" errors.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { SeasonCreationWizard } from '@/operator/SeasonCreationWizard';
import * as useOperatorIdModule from '@/api/hooks';

// Mock the Supabase client with chainable query builder
vi.mock('@/supabaseClient', () => {
  const createChainableQuery = (finalData: unknown) => {
    const chain: Record<string, Mock> = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      gte: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve(finalData)),
    };
    // Return both a promise and chainable methods
    return Object.assign(Promise.resolve(finalData), chain);
  };

  return {
    supabase: {
      from: vi.fn((table: string) => {
        // Provide default responses for different tables
        if (table === 'leagues') {
          return createChainableQuery({
            data: {
              id: 'test-league-id',
              league_name: 'Test League',
              game_type: '8ball',
              day_of_week: 'wednesday',
              league_start_date: '2025-01-08',
              operator_id: 'test-operator-id',
            },
            error: null,
          });
        }
        if (table === 'championship_date_options') {
          return createChainableQuery({
            data: [],
            error: null,
          });
        }
        if (table === 'operator_blackout_preferences') {
          return createChainableQuery({
            data: [],
            error: null,
          });
        }
        // Default response for any other table
        return createChainableQuery({
          data: [],
          error: null,
        });
      }),
    },
  };
});

// Mock the useOperatorId hook
vi.spyOn(useOperatorIdModule, 'useOperatorId').mockReturnValue({
  data: { id: 'test-operator-id' },
  isLoading: false,
  error: null,
} as unknown as ReturnType<typeof useOperatorIdModule.useOperatorId>);

// Mock date-holidays package (used by holidayUtils)
vi.mock('date-holidays', () => {
  return {
    default: class MockHolidays {
      init() {
        return this;
      }
      getHolidays() {
        return [];
      }
    },
  };
});

describe('SeasonCreationWizard - Smoke Test', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Mock useParams to return a test leagueId
    vi.mock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useParams: () => ({ leagueId: 'test-league-id' }),
        useSearchParams: () => [new URLSearchParams(), vi.fn()],
        useNavigate: () => vi.fn(),
      };
    });
  });

  it('should render the wizard without crashing', async () => {
    renderWithProviders(<SeasonCreationWizard />);

    // Wait for loading to complete
    await waitFor(
      () => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify the wizard rendered successfully
    expect(screen.getByText(/Create/i)).toBeInTheDocument();
  });

  it('should display the "Back to League" button', async () => {
    renderWithProviders(<SeasonCreationWizard />);

    await waitFor(
      () => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Check for "Back to League" button
    expect(screen.getByText('Back to League')).toBeInTheDocument();
  });

  it('should display navigation buttons', async () => {
    renderWithProviders(<SeasonCreationWizard />);

    await waitFor(
      () => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Check for navigation buttons (Back/Next or similar)
    // Note: The exact buttons depend on which step is shown
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should not throw JavaScript errors on mount', async () => {
    // This test will fail if there are unhandled errors during render
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderWithProviders(<SeasonCreationWizard />);

    await waitFor(
      () => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify no console errors were logged
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
