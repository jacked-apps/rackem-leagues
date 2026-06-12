/**
 * @fileoverview Tests for SetupSummaryCard — the at-a-glance Manage Teams summary.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SetupSummaryCard } from './SetupSummaryCard';

const base = {
  isTraveling: false,
  isInHouse: false,
  venueCount: 0,
  tablesAvailable: 0,
  teamCount: 0,
  maxTeams: 0,
  isAtMaxTeams: false,
};

describe('SetupSummaryCard', () => {
  it('shows "Not Set" when neither traveling nor in-house', () => {
    render(<SetupSummaryCard {...base} />);
    expect(screen.getByText('Not Set')).toBeInTheDocument();
  });

  it('shows Traveling / In-House by flag', () => {
    const { rerender } = render(<SetupSummaryCard {...base} isTraveling />);
    expect(screen.getByText('Traveling')).toBeInTheDocument();
    rerender(<SetupSummaryCard {...base} isInHouse />);
    expect(screen.getByText('In-House')).toBeInTheDocument();
  });

  it('renders the venue, table, and teams/max counts', () => {
    render(
      <SetupSummaryCard
        {...base}
        isInHouse
        venueCount={2}
        tablesAvailable={7}
        teamCount={3}
        maxTeams={14}
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('3/14')).toBeInTheDocument();
  });

  it('flags the teams count in warning color at max', () => {
    render(<SetupSummaryCard {...base} teamCount={14} maxTeams={14} isAtMaxTeams />);
    expect(screen.getByText('14/14')).toHaveClass('text-warning');
  });
});
