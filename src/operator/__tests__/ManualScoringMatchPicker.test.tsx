/**
 * @fileoverview Component tests for the LO manual-scoring match picker:
 * eligible matches are clickable + route to the scoring page; ineligible ones
 * are shown but inert; empty state when nothing is eligible.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Stub PageHeader to avoid its provider/nav dependencies in a unit render.
vi.mock('@/components/PageHeader', () => ({
  PageHeader: ({ title }: { title: React.ReactNode }) => <div>{title}</div>,
}));
vi.mock('@/api/hooks', () => ({ useActiveSeason: vi.fn() }));
vi.mock('@/hooks/useSeasonSchedule', () => ({ useSeasonSchedule: vi.fn() }));

import { useActiveSeason } from '@/api/hooks';
import { useSeasonSchedule } from '@/hooks/useSeasonSchedule';
import ManualScoringMatchPicker from '../ManualScoringMatchPicker';

const team = (name: string) => ({
  id: name,
  team_name: name,
  captain_id: null,
  status: 'active' as const,
});

const mkMatch = (id: string, status: string) => ({
  id,
  status,
  home_team: team('Sharks'),
  away_team: team('Jets'),
});

function mockSchedule(matches: Array<ReturnType<typeof mkMatch>>) {
  vi.mocked(useActiveSeason).mockReturnValue({ data: { id: 'S1' }, isLoading: false } as never);
  vi.mocked(useSeasonSchedule).mockReturnValue({
    schedule: [{ week: { id: 'w1', scheduled_date: '2026-06-10' }, matches }],
    seasonName: 'Spring',
    loading: false,
    error: null,
    refetch: vi.fn(),
  } as never);
}

function renderPicker() {
  return render(
    <MemoryRouter initialEntries={['/league/L1/manual-scoring']}>
      <Routes>
        <Route path="/league/:leagueId/manual-scoring" element={<ManualScoringMatchPicker />} />
        <Route
          path="/league/:leagueId/manual-scoring/:matchId"
          element={<div>SCORING PAGE</div>}
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('ManualScoringMatchPicker', () => {
  it('renders scheduled matches as clickable and others as inert', () => {
    mockSchedule([mkMatch('m1', 'scheduled'), mkMatch('m2', 'completed')]);
    renderPicker();

    expect(screen.getAllByTestId('eligible-match')).toHaveLength(1);
    expect(screen.getAllByTestId('ineligible-match')).toHaveLength(1);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('navigates to the scoring page when an eligible match is clicked', () => {
    mockSchedule([mkMatch('m1', 'scheduled')]);
    renderPicker();

    fireEvent.click(screen.getByTestId('eligible-match'));
    expect(screen.getByText('SCORING PAGE')).toBeInTheDocument();
  });

  it('shows the empty-eligibility note when no match is scheduled', () => {
    mockSchedule([mkMatch('m1', 'completed'), mkMatch('m2', 'in_progress')]);
    renderPicker();

    expect(screen.queryByTestId('eligible-match')).not.toBeInTheDocument();
    expect(screen.getByText(/No matches are currently available for manual entry/)).toBeInTheDocument();
  });

  it('shows the no-active-season state', () => {
    vi.mocked(useActiveSeason).mockReturnValue({ data: null, isLoading: false } as never);
    vi.mocked(useSeasonSchedule).mockReturnValue({
      schedule: [],
      seasonName: '',
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    renderPicker();

    expect(screen.getByText(/no active season/i)).toBeInTheDocument();
  });
});
