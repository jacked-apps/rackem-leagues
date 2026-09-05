// @vitest-environment jsdom
/**
 * @fileoverview Tests for EntryFeePanel — the entry-fee paid/unpaid checklist.
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { EntryFeePanel } from './EntryFeePanel';
import type { BracketParticipantRow } from '@/api/queries/brackets';

function participant(over: Partial<BracketParticipantRow>): BracketParticipantRow {
  return {
    id: over.id ?? 'p1',
    bracket_id: 'b1',
    display_name: over.display_name ?? 'Ann',
    seed: over.seed ?? 1,
    member_id: null,
    entry_fee_paid: over.entry_fee_paid ?? false,
    created_at: '2026-09-05T00:00:00Z',
  } as BracketParticipantRow;
}

describe('EntryFeePanel', () => {
  it('lists players with paid/unpaid status and a running count', () => {
    const participants = [
      participant({ id: 'p1', display_name: 'Ann', entry_fee_paid: true }),
      participant({ id: 'p2', display_name: 'Bo', entry_fee_paid: false }),
    ];
    renderWithProviders(<EntryFeePanel bracketId="b1" participants={participants} />);

    expect(screen.getByText('Ann')).toBeTruthy();
    expect(screen.getByText('Bo')).toBeTruthy();
    expect(screen.getByText('1 of 2 paid')).toBeTruthy();
    expect(screen.getByText('Paid')).toBeTruthy();
    expect(screen.getByText('Unpaid')).toBeTruthy();
  });

  it('notes the cash-is-collected-outside-the-app framing', () => {
    renderWithProviders(
      <EntryFeePanel bracketId="b1" participants={[participant({})]} />
    );
    expect(screen.getByText(/you collect the cash/i)).toBeTruthy();
  });
});
