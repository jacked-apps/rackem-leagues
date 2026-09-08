/**
 * @fileoverview Tests for removalConsequence — the Remove confirm's promise.
 */

import { describe, it, expect } from 'vitest';
import { removalConsequence } from './removalConsequence';
import type { HopperRow } from './hopperGroups';

function row(over: {
  kind: 'registered' | 'walkup';
  status: 'hopper' | 'official';
}): HopperRow {
  return {
    id: 'h1',
    entry: { status: over.status } as HopperRow['entry'],
    identity: { kind: over.kind } as HopperRow['identity'],
    duplicateName: false,
  };
}

describe('removalConsequence', () => {
  it('promises a registered player stays in past players', () => {
    expect(removalConsequence(row({ kind: 'registered', status: 'official' }))).toMatch(
      /stay in your past players/i
    );
  });

  it('promises the same for a registered player who was only waiting', () => {
    // The sticky roster is keyed to the member, not to this tournament.
    expect(removalConsequence(row({ kind: 'registered', status: 'hopper' }))).toMatch(
      /stay in your past players/i
    );
  });

  it('promises an admitted walk-up their NAME is kept', () => {
    const text = removalConsequence(row({ kind: 'walkup', status: 'official' }));
    expect(text).toMatch(/name stays in your past players/i);
  });

  it('warns that a never-admitted walk-up has not been saved yet', () => {
    const text = removalConsequence(row({ kind: 'walkup', status: 'hopper' }));
    expect(text).toMatch(/isn't saved yet/i);
    expect(text).toMatch(/type it again/i);
  });
});
