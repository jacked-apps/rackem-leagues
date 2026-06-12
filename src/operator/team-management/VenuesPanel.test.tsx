/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures use minimal `as any` shapes */
/**
 * @fileoverview Tests for VenuesPanel — the "League Venues" assignment section.
 * The heavy VenueListItem child is mocked so we test the panel's own logic
 * (empty state, select-all, new-venue, and the derived assigned/capacity props).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VenuesPanel } from './VenuesPanel';

// Mock VenueListItem → render a probe that surfaces the derived props.
vi.mock('@/components/VenueListItem', () => ({
  VenueListItem: ({ venue, isAssigned, capacity, teamsAtVenue, onToggle, onLimitClick }: any) => (
    <div data-testid={`venue-${venue.id}`}>
      <span>{venue.name}</span>
      <span data-testid={`assigned-${venue.id}`}>{String(isAssigned)}</span>
      <span data-testid={`cap-${venue.id}`}>{String(capacity)}</span>
      <span data-testid={`teams-${venue.id}`}>{teamsAtVenue}</span>
      <button onClick={onToggle}>toggle-{venue.id}</button>
      <button onClick={onLimitClick}>limit-{venue.id}</button>
    </div>
  ),
}));

const venueA = { id: 'v1', name: 'Corner Pocket' } as any;
const venueB = { id: 'v2', name: 'Side Pocket' } as any;

const base = {
  venues: [] as any[],
  leagueVenues: [] as any[],
  teams: [] as any[],
  organizationId: 'org1',
  assigningVenueId: null,
  selectingAll: false,
  onSelectAll: vi.fn(),
  onNewVenue: vi.fn(),
  onToggleVenue: vi.fn(),
  onOpenLimitModal: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());

describe('VenuesPanel', () => {
  it('empty state: shows "No venues yet" + Add Venue (calls onNewVenue)', () => {
    const onNewVenue = vi.fn();
    render(<VenuesPanel {...base} venues={[]} onNewVenue={onNewVenue} />);
    expect(screen.getByText('No venues yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add venue/i }));
    expect(onNewVenue).toHaveBeenCalled();
  });

  it('renders a row per venue with derived assigned/capacity/teams-at-venue', () => {
    render(
      <VenuesPanel
        {...base}
        venues={[venueA, venueB]}
        leagueVenues={[{ venue_id: 'v1', capacity: 4 } as any]}
        teams={[{ id: 't1', home_venue_id: 'v1' } as any]}
      />,
    );
    // v1 assigned (has a league_venue), capacity 4, 1 team home there.
    expect(screen.getByTestId('assigned-v1')).toHaveTextContent('true');
    expect(screen.getByTestId('cap-v1')).toHaveTextContent('4');
    expect(screen.getByTestId('teams-v1')).toHaveTextContent('1');
    // v2 not assigned.
    expect(screen.getByTestId('assigned-v2')).toHaveTextContent('false');
    expect(screen.getByTestId('teams-v2')).toHaveTextContent('0');
  });

  it('select-all is checked only when every venue is assigned, and toggles via onSelectAll', () => {
    const onSelectAll = vi.fn();
    render(
      <VenuesPanel
        {...base}
        venues={[venueA, venueB]}
        leagueVenues={[{ venue_id: 'v1' } as any, { venue_id: 'v2' } as any]}
        onSelectAll={onSelectAll}
      />,
    );
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(onSelectAll).toHaveBeenCalled();
  });

  it('select-all is unchecked when not all venues are assigned', () => {
    render(
      <VenuesPanel
        {...base}
        venues={[venueA, venueB]}
        leagueVenues={[{ venue_id: 'v1' } as any]}
      />,
    );
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('forwards toggle + limit clicks for a venue', () => {
    const onToggleVenue = vi.fn();
    const onOpenLimitModal = vi.fn();
    render(
      <VenuesPanel
        {...base}
        venues={[venueA]}
        onToggleVenue={onToggleVenue}
        onOpenLimitModal={onOpenLimitModal}
      />,
    );
    fireEvent.click(screen.getByText('toggle-v1'));
    fireEvent.click(screen.getByText('limit-v1'));
    expect(onToggleVenue).toHaveBeenCalledWith(venueA);
    expect(onOpenLimitModal).toHaveBeenCalledWith(venueA);
  });
});
