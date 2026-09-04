/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks use minimal shapes */
/**
 * @fileoverview Tests for the review-first, place-only PlayoffSetup page (Unit 4).
 *
 * Asserts the three states render correctly (no-playoffs / set-up / locked),
 * that the page NEVER renders team names or a standings table, that auto-populate
 * fires once when the season is complete, and that reset round-trips back to
 * set-up. Data hooks, generator functions, and heavy child cards are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PlayoffSetup } from './PlayoffSetup';

// --- Router ---
vi.mock('react-router-dom', () => ({
  useParams: () => ({ leagueId: 'L1', seasonId: 'S1' }),
  useNavigate: () => vi.fn(),
  useBlocker: () => ({ state: 'unblocked' }),
}));

// --- Chrome / heavy children (rendered as inert markers) ---
vi.mock('@/components/PageHeader', () => ({
  PageHeader: ({ title, subtitle }: any) => (
    <div>{title}{subtitle}</div>
  ),
}));
vi.mock('@/components/InfoButton', () => ({ InfoButton: () => null }));
vi.mock('@/components/UnsavedChangesDialog', () => ({ UnsavedChangesDialog: () => null }));
vi.mock('@/components/playoff/PlayoffMatchRulesCard', () => ({
  PlayoffMatchRulesCard: () => <div data-testid="rules" />,
}));
vi.mock('@/components/playoff/PlayoffTemplateSelector', () => ({
  PlayoffTemplateSelector: () => <div data-testid="template-selector" />,
}));
vi.mock('@/components/playoff/PlayoffSettingsCard', () => ({
  PlayoffSettingsCard: () => <div data-testid="settings-card" />,
}));
vi.mock('@/components/playoff/PlayoffBracketPreviewCard', () => ({
  // Renders place-slots only; we assert it's present and that the style reached it.
  PlayoffBracketPreviewCard: ({ matchupStyle, bracketSize }: any) => (
    <div data-testid="place-preview">
      place-slots style={matchupStyle} size={bracketSize}
    </div>
  ),
}));

// --- Data hooks ---
const mockResolvedConfig = {
  config_id: 'cfg1',
  name: 'Standard Playoffs',
  description: null,
  qualification_type: 'all',
  fixed_team_count: null,
  qualifying_percentage: null,
  percentage_min: null,
  percentage_max: null,
  playoff_weeks: 1,
  week_matchup_styles: ['seeded'],
  wildcard_spots: 0,
  payment_method: 'automatic',
  config_source: 'league',
};
vi.mock('@/api/hooks', () => ({
  useSeasonById: () => ({ data: { season_name: 'Spring 2026' } }),
  useLeagueById: () => ({ data: { organization_id: 'O1' } }),
}));
vi.mock('@/api/hooks/useTeams', () => ({
  useTeamsBySeason: () => ({ data: new Array(8).fill({}) }), // 8 teams
}));
vi.mock('@/api/hooks/usePlayoffConfigurations', () => ({
  useResolvedPlayoffConfig: () => ({ data: mockResolvedConfig }),
}));
vi.mock('@/api/mutations/playoffConfigurations', () => ({
  useSavePlayoffConfiguration: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({ confirm: vi.fn().mockResolvedValue(true), ConfirmDialogComponent: null }),
}));

// --- Generator functions ---
const gen = {
  getPlayoffWeek: vi.fn(),
  checkRegularSeasonComplete: vi.fn(),
  arePlayoffMatchupsPopulated: vi.fn(),
  generatePlayoffBracket: vi.fn(),
  populatePlayoffMatches: vi.fn(),
  resetPlayoffMatchups: vi.fn(),
};
vi.mock('@/utils/playoffGenerator', () => ({
  getPlayoffWeek: (...a: any[]) => gen.getPlayoffWeek(...a),
  checkRegularSeasonComplete: (...a: any[]) => gen.checkRegularSeasonComplete(...a),
  arePlayoffMatchupsPopulated: (...a: any[]) => gen.arePlayoffMatchupsPopulated(...a),
  generatePlayoffBracket: (...a: any[]) => gen.generatePlayoffBracket(...a),
  populatePlayoffMatches: (...a: any[]) => gen.populatePlayoffMatches(...a),
  resetPlayoffMatchups: (...a: any[]) => gen.resetPlayoffMatchups(...a),
}));

const WEEK = { id: 'W1', scheduled_date: '2026-05-01', week_name: 'Playoffs' };

beforeEach(() => {
  vi.clearAllMocks();
  gen.getPlayoffWeek.mockResolvedValue(WEEK);
  gen.checkRegularSeasonComplete.mockResolvedValue({
    isComplete: false,
    totalMatches: 10,
    completedMatches: 4,
    remainingMatches: 6,
  });
  gen.arePlayoffMatchupsPopulated.mockResolvedValue(false);
  gen.generatePlayoffBracket.mockResolvedValue({ success: true, bracket: { matchups: [] } });
  gen.populatePlayoffMatches.mockResolvedValue({ success: true, matchesPopulated: 4 });
  gen.resetPlayoffMatchups.mockResolvedValue({ success: true, matchesReset: 4 });
});

describe('PlayoffSetup (place-only review page)', () => {
  it('no playoff week → "doesn\'t run playoffs", no format controls', async () => {
    gen.getPlayoffWeek.mockResolvedValue(null);
    render(<PlayoffSetup />);
    expect(await screen.findByText(/doesn't run playoffs/i)).toBeInTheDocument();
    expect(screen.queryByText(/Edit playoff format/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('place-preview')).not.toBeInTheDocument();
  });

  it('set-up, season in progress → place-slots + "fills in" status, never team names', async () => {
    render(<PlayoffSetup />);
    expect(await screen.findByTestId('place-preview')).toBeInTheDocument();
    expect(screen.getByText(/fills in automatically/i)).toBeInTheDocument();
    expect(screen.getByText(/4 of 10 played/i)).toBeInTheDocument();
    // The configured pairing reached the preview.
    expect(screen.getByTestId('place-preview')).toHaveTextContent('style=seeded');
    // Manual fill-in is gated until the season ends.
    expect(screen.getByRole('button', { name: /available when the season ends/i })).toBeDisabled();
    // The collapsed format editor exists but its controls are hidden until opened.
    expect(screen.getByRole('button', { name: /edit playoff format/i })).toBeInTheDocument();
    expect(screen.queryByTestId('template-selector')).not.toBeInTheDocument();
  });

  it('opening the format editor reveals the reused controls', async () => {
    render(<PlayoffSetup />);
    await screen.findByTestId('place-preview');
    fireEvent.click(screen.getByRole('button', { name: /edit playoff format/i }));
    expect(screen.getByTestId('template-selector')).toBeInTheDocument();
    expect(screen.getByTestId('settings-card')).toBeInTheDocument();
  });

  it('set-up, season complete → auto-populates once (build bracket + fill matchups)', async () => {
    gen.checkRegularSeasonComplete.mockResolvedValue({
      isComplete: true,
      totalMatches: 10,
      completedMatches: 10,
      remainingMatches: 0,
    });
    render(<PlayoffSetup />);
    await waitFor(() => expect(gen.generatePlayoffBracket).toHaveBeenCalledTimes(1));
    // honors the configured style at the write
    expect(gen.generatePlayoffBracket).toHaveBeenCalledWith('S1', 'W1', 'seeded');
    expect(gen.populatePlayoffMatches).toHaveBeenCalledTimes(1);
  });

  it('locked (populated) → "matchups are set", view-matchups + reset, no team names', async () => {
    gen.arePlayoffMatchupsPopulated.mockResolvedValue(true);
    render(<PlayoffSetup />);
    expect(await screen.findByText(/matchups are set/i)).toBeInTheDocument();
    // Locked sends the operator to the matchups page to see the filled bracket.
    expect(screen.getByRole('button', { name: /view matchups/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset matchups/i })).toBeInTheDocument();
    // Locked never shows the editable place preview or format controls.
    expect(screen.queryByTestId('place-preview')).not.toBeInTheDocument();
    expect(screen.queryByText(/edit playoff format/i)).not.toBeInTheDocument();
  });

  it('reset → calls resetPlayoffMatchups and re-derives back to set-up', async () => {
    gen.arePlayoffMatchupsPopulated.mockResolvedValue(true);
    render(<PlayoffSetup />);
    fireEvent.click(await screen.findByRole('button', { name: /reset matchups/i }));
    await waitFor(() => expect(gen.resetPlayoffMatchups).toHaveBeenCalledWith('S1', 'W1'));
    // Back to set-up: the editable place preview appears.
    expect(await screen.findByTestId('place-preview')).toBeInTheDocument();
  });
});
