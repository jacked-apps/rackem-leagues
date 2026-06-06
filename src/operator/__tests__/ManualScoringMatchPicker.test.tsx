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
        <Route
          path="/league/:leagueId/match-review/:matchId"
          element={<div>REVIEW PAGE</div>}
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('ManualScoringMatchPicker', () => {
  it('renders scheduled as scorable, finished as reviewable, and others as inert', () => {
    mockSchedule([
      mkMatch('m1', 'scheduled'),
      mkMatch('m2', 'completed'),
      mkMatch('m3', 'forfeited'),
    ]);
    renderPicker();

    expect(screen.getAllByTestId('eligible-match')).toHaveLength(1);
    expect(screen.getAllByTestId('review-match')).toHaveLength(1);
    expect(screen.getAllByTestId('ineligible-match')).toHaveLength(1);
  });

  it('navigates to the scoring page when a scheduled match is clicked', () => {
    mockSchedule([mkMatch('m1', 'scheduled')]);
    renderPicker();

    fireEvent.click(screen.getByTestId('eligible-match'));
    expect(screen.getByText('SCORING PAGE')).toBeInTheDocument();
  });

  it('resumes an updating match (LO walked away mid-entry) into the scoring page', () => {
    mockSchedule([mkMatch('m1', 'updating')]);
    renderPicker();

    expect(screen.getByText('Updating')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('eligible-match'));
    expect(screen.getByText('SCORING PAGE')).toBeInTheDocument();
  });

  it('navigates to the review page when a finished match is clicked', () => {
    mockSchedule([mkMatch('m1', 'completed')]);
    renderPicker();

    fireEvent.click(screen.getByTestId('review-match'));
    expect(screen.getByText('REVIEW PAGE')).toBeInTheDocument();
  });

  it('shows the empty note when no match is scorable or reviewable', () => {
    mockSchedule([mkMatch('m1', 'forfeited'), mkMatch('m2', 'in_progress')]);
    renderPicker();

    expect(screen.queryByTestId('eligible-match')).not.toBeInTheDocument();
    expect(screen.queryByTestId('review-match')).not.toBeInTheDocument();
    expect(screen.getByText(/No matches are currently available to score or review/)).toBeInTheDocument();
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
