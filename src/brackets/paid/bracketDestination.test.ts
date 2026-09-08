/**
 * @fileoverview Tests for bracketDestination — which page a tournament opens at.
 */

import { describe, it, expect } from 'vitest';
import { bracketDestination, usesHopperSetup } from './bracketDestination';

function bracket(status: string, features: string[] | null) {
  return { id: 'b1', status, premium_features: features };
}

describe('bracketDestination', () => {
  it('opens a waiting sign-up tournament on its hopper', () => {
    expect(bracketDestination(bracket('setup', ['real_players']))).toBe('/brackets/b1/setup');
  });

  it('opens a sign-up tournament on its bracket once it has started', () => {
    expect(bracketDestination(bracket('live', ['real_players']))).toBe('/brackets/b1');
    expect(bracketDestination(bracket('complete', ['real_players']))).toBe('/brackets/b1');
    expect(bracketDestination(bracket('closed', ['real_players']))).toBe('/brackets/b1');
  });

  it('never sends a free tournament to a hopper it does not have', () => {
    // Free tournaments are created and started in one submit, so `setup` here
    // only happens if a start failed — and there is still no hopper to show.
    expect(bracketDestination(bracket('setup', null))).toBe('/brackets/b1');
    expect(bracketDestination(bracket('live', null))).toBe('/brackets/b1');
  });

  it('never sends a paid tournament WITHOUT sign-up to a hopper', () => {
    expect(bracketDestination(bracket('setup', ['payment_tracker']))).toBe('/brackets/b1');
  });

  it('needs both halves to be a hopper tournament', () => {
    expect(usesHopperSetup(bracket('setup', ['real_players']))).toBe(true);
    expect(usesHopperSetup(bracket('live', ['real_players']))).toBe(false);
    expect(usesHopperSetup(bracket('setup', ['payment_tracker']))).toBe(false);
  });
});
