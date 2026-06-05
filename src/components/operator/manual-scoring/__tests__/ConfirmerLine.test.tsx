/**
 * @fileoverview Component tests for the per-game ConfirmerLine: official names
 * per side, the "+N others" peek, and the no-log "+0" case.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmerLine } from '../ConfirmerLine';
import type { ConfirmerAudit } from '@/utils/match/confirmerAudit';

const audit = (over: Partial<ConfirmerAudit> = {}): ConfirmerAudit => ({
  home: { official: { id: 'h1', name: 'Ace', team: 'Sharks' }, others: [] },
  away: { official: { id: 'a1', name: 'Dee', team: 'Jets' }, others: [] },
  ...over,
});

function renderLine(a: ConfirmerAudit) {
  return render(<ConfirmerLine audit={a} homeTeamName="Sharks" awayTeamName="Jets" />);
}

describe('ConfirmerLine', () => {
  it('shows a "Confirmed by" label and each side as Home/Away: Player (Team)', () => {
    renderLine(audit());
    const line = screen.getByTestId('confirmer-line');
    expect(line).toHaveTextContent('Confirmed by');
    expect(line).toHaveTextContent('Home:');
    expect(line).toHaveTextContent('Ace (Sharks)');
    expect(line).toHaveTextContent('Away:');
    expect(line).toHaveTextContent('Dee (Jets)');
  });

  it('shows no "+N others" chip when there are none (no-log / +0 game)', () => {
    renderLine(audit());
    expect(screen.queryByTestId('others-peek')).not.toBeInTheDocument();
  });

  it('reveals the extra witnesses (name + team) when the peek is tapped', () => {
    renderLine(
      audit({
        home: {
          official: { id: 'h1', name: 'Ace', team: 'Sharks' },
          others: [{ id: 'h2', name: 'Bo', team: 'Sharks' }],
        },
      })
    );
    const peek = screen.getByTestId('others-peek');
    expect(peek).toHaveTextContent('+1 other');
    fireEvent.click(peek);
    expect(screen.getByText('Bo')).toBeInTheDocument();
  });

  it('shows "Unconfirmed" when a side has no official', () => {
    renderLine(audit({ home: { official: null, others: [] } }));
    expect(screen.getByTestId('confirmer-line')).toHaveTextContent('Unconfirmed');
  });
});
