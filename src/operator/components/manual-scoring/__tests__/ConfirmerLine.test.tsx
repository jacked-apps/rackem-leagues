/**
 * @fileoverview Component tests for the ConfirmerLine panel: two columns
 * (Home/Away) with the team name and the full list of confirmer names per side.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// PlayerNameLink pulls in member/auth/messaging hooks — stub it to plain text
// so this panel test stays isolated to layout.
vi.mock('@/components/PlayerNameLink', () => ({
  PlayerNameLink: ({ playerName }: { playerName: string }) => <span>{playerName}</span>,
}));

import { ConfirmerLine } from '../ConfirmerLine';
import type { ConfirmerAudit } from '@/utils/match/confirmerAudit';

const audit = (over: Partial<ConfirmerAudit> = {}): ConfirmerAudit => ({
  home: { official: { id: 'h1', name: 'John Smith', team: 'Sharks' }, others: [] },
  away: { official: { id: 'a1', name: 'Jane Doe', team: 'Jets' }, others: [] },
  ...over,
});

function renderLine(a: ConfirmerAudit) {
  return render(<ConfirmerLine audit={a} homeTeamName="Sharks" awayTeamName="Jets" />);
}

describe('ConfirmerLine', () => {
  it('shows "Confirmed by" + Home/Away team headers and the official names', () => {
    renderLine(audit());
    const line = screen.getByTestId('confirmer-line');
    expect(line).toHaveTextContent('Confirmed by');
    expect(line).toHaveTextContent('Home: Sharks');
    expect(line).toHaveTextContent('Away: Jets');
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('lists EVERY confirmer per side — official + extras, no peek/popover', () => {
    renderLine(
      audit({
        home: {
          official: { id: 'h1', name: 'John Smith', team: 'Sharks' },
          others: [
            { id: 'h2', name: 'Bob Jones', team: 'Sharks' },
            { id: 'h3', name: 'Cy Young', team: 'Sharks' },
          ],
        },
      })
    );
    // All three home confirmers are visible at once (no "+N others" button).
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('Cy Young')).toBeInTheDocument();
    expect(screen.queryByTestId('others-peek')).not.toBeInTheDocument();
  });

  it('shows "Unconfirmed" when a side has no confirmers', () => {
    renderLine(audit({ home: { official: null, others: [] } }));
    expect(screen.getByTestId('confirmer-line')).toHaveTextContent('Unconfirmed');
  });
});
