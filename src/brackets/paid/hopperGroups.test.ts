/**
 * @fileoverview Tests for buildHopperGroups — the hopper screen's three groups.
 */

import { describe, it, expect } from 'vitest';
import { buildHopperGroups } from './hopperGroups';
import type { HopperEntry, RosterPlayer } from '@/api/queries/brackets';

function entry(over: Partial<HopperEntry>): HopperEntry {
  return {
    id: 'h1',
    member_id: null,
    display_name: 'Someone',
    status: 'hopper',
    paid_status: null,
    added_via: 'search',
    seed: null,
    created_at: '2026-09-06T00:00:00Z',
    nickname: null,
    first_name: null,
    last_name: null,
    system_player_number: null,
    city: null,
    state: null,
    ...over,
  };
}

function rosterPlayer(over: Partial<RosterPlayer> = {}): RosterPlayer {
  return {
    member_id: 'm1',
    display_name: null,
    nickname: 'Kenny',
    first_name: 'Ken',
    last_name: 'Baker',
    system_player_number: 333,
    city: 'Erie',
    state: 'PA',
    first_seen_at: '2026-08-01T00:00:00Z',
    ...over,
  };
}

/** A remembered walk-up: no account, the name is the whole identity. */
function rememberedWalkup(name: string): RosterPlayer {
  return rosterPlayer({
    member_id: null,
    display_name: name,
    nickname: null,
    first_name: null,
    last_name: null,
    system_player_number: null,
    city: null,
    state: null,
  });
}

describe('buildHopperGroups', () => {
  it('splits hopper rows into the official and waiting groups with counts', () => {
    const groups = buildHopperGroups(
      [
        entry({ id: 'a', status: 'official', display_name: 'Mike' }),
        entry({ id: 'b', status: 'hopper', display_name: 'Slim' }),
        entry({ id: 'c', status: 'hopper', display_name: 'Doc' }),
      ],
      [rosterPlayer()]
    );

    expect(groups.official.map((r) => r.id)).toEqual(['a']);
    expect(groups.waiting.map((r) => r.id)).toEqual(['b', 'c']);
    expect(groups.counts).toEqual({ official: 1, waiting: 2, past: 1 });
  });

  it('orders the official list by seed and the waiting list by arrival', () => {
    const groups = buildHopperGroups(
      [
        entry({ id: 'a', status: 'official', seed: 3 }),
        entry({ id: 'b', status: 'official', seed: 1 }),
        entry({ id: 'c', status: 'hopper', created_at: '2026-09-06T02:00:00Z' }),
        entry({ id: 'd', status: 'hopper', created_at: '2026-09-06T01:00:00Z' }),
      ],
      []
    );

    expect(groups.official.map((r) => r.id)).toEqual(['b', 'a']);
    expect(groups.waiting.map((r) => r.id)).toEqual(['d', 'c']);
  });

  it('shows a registered player nickname-first with their number and home', () => {
    const groups = buildHopperGroups(
      [
        entry({
          id: 'a',
          member_id: 'm9',
          display_name: 'William Stone',
          nickname: 'Slim',
          first_name: 'William',
          last_name: 'Stone',
          system_player_number: 1042,
          city: 'Buffalo',
          state: 'NY',
        }),
      ],
      []
    );

    const row = groups.waiting[0];
    expect(row.identity.kind).toBe('registered');
    expect(row.identity.displayName).toBe('Slim');
    expect(row.identity.playerNumber).toBe(1042);
    expect(row.identity.home).toBe('Buffalo, NY');
  });

  it('shows a walk-up as their typed name with nothing to disambiguate by', () => {
    const groups = buildHopperGroups([entry({ id: 'a', display_name: 'Rocket' })], []);

    const row = groups.waiting[0];
    expect(row.identity.kind).toBe('walkup');
    expect(row.identity.displayName).toBe('Rocket');
    expect(row.identity.playerNumber).toBeNull();
    expect(row.identity.home).toBeNull();
  });

  it('flags a shared name across DIFFERENT groups, ignoring case and padding', () => {
    const groups = buildHopperGroups(
      [
        entry({ id: 'a', status: 'official', display_name: 'Slim ' }),
        entry({ id: 'b', status: 'hopper', display_name: 'slim' }),
        entry({ id: 'c', status: 'hopper', display_name: 'Doc' }),
      ],
      [rosterPlayer({ member_id: 'm2', nickname: 'Ray' })]
    );

    expect(groups.official[0].duplicateName).toBe(true);
    expect(groups.waiting.find((r) => r.id === 'b')!.duplicateName).toBe(true);
    expect(groups.waiting.find((r) => r.id === 'c')!.duplicateName).toBe(false);
    expect(groups.past[0].duplicateName).toBe(false);
  });

  it('flags a name shared between a candidate and a past player', () => {
    const groups = buildHopperGroups(
      [entry({ id: 'a', display_name: 'Kenny' })],
      [rosterPlayer({ nickname: 'Kenny' })]
    );

    expect(groups.waiting[0].duplicateName).toBe(true);
    expect(groups.past[0].duplicateName).toBe(true);
  });

  it('handles both reads being empty', () => {
    const groups = buildHopperGroups([], []);
    expect(groups.counts).toEqual({ official: 0, waiting: 0, past: 0 });
  });

  it('lists a remembered walk-up in past players, keyed by name', () => {
    const groups = buildHopperGroups([], [rememberedWalkup('Rocket')]);

    expect(groups.counts.past).toBe(1);
    const row = groups.past[0];
    expect(row.key).toBe('walkup:rocket');
    expect(row.identity.kind).toBe('walkup');
    expect(row.identity.displayName).toBe('Rocket');
    expect(row.identity.playerNumber).toBeNull();
  });

  it('keeps registered and remembered-walk-up past players in one list', () => {
    const groups = buildHopperGroups(
      [],
      [rosterPlayer({ member_id: 'm-kenny', nickname: 'Kenny' }), rememberedWalkup('Rocket')]
    );

    expect(groups.past.map((r) => r.identity.displayName)).toEqual(['Kenny', 'Rocket']);
    expect(groups.past.map((r) => r.player.member_id)).toEqual(['m-kenny', null]);
  });

  it('flags a walk-up in the tournament sharing a name with a remembered one', () => {
    const groups = buildHopperGroups(
      [entry({ id: 'a', display_name: 'Rocket' })],
      [rememberedWalkup('Rocket')]
    );

    expect(groups.waiting[0].duplicateName).toBe(true);
    expect(groups.past[0].duplicateName).toBe(true);
  });
});
