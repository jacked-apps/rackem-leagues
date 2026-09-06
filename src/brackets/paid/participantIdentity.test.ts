/**
 * @fileoverview Tests for participant identity + kind (Units B1 + B2).
 */

import { describe, it, expect } from 'vitest';
import { participantKind } from './participantKind';
import { resolveParticipantIdentity } from './participantIdentity';

describe('participantKind', () => {
  it('is registered when a member is linked, walkup otherwise', () => {
    expect(participantKind({ member_id: 'm1' })).toBe('registered');
    expect(participantKind({ member_id: null })).toBe('walkup');
  });
});

describe('resolveParticipantIdentity', () => {
  const member = {
    nickname: 'Ace',
    first_name: 'Alice',
    last_name: 'Nguyen',
    system_player_number: 1042,
    city: 'Portland',
    state: 'OR',
  };

  it('a registered player shows nickname (primary) + number + home', () => {
    const id = resolveParticipantIdentity({ member_id: 'm1', display_name: 'Alice N' }, member);
    expect(id.kind).toBe('registered');
    expect(id.displayName).toBe('Ace');
    expect(id.playerNumber).toBe(1042);
    expect(id.home).toBe('Portland, OR');
  });

  it('falls back to full name when a registered player has no nickname', () => {
    const id = resolveParticipantIdentity(
      { member_id: 'm1', display_name: null },
      { ...member, nickname: null }
    );
    expect(id.displayName).toBe('Alice Nguyen');
  });

  it('a walk-up shows the typed name only — no number/home', () => {
    const id = resolveParticipantIdentity({ member_id: null, display_name: 'Joe D.' });
    expect(id.kind).toBe('walkup');
    expect(id.displayName).toBe('Joe D.');
    expect(id.playerNumber).toBeNull();
    expect(id.home).toBeNull();
  });

  it('guards missing data (never throws, falls back to a label)', () => {
    // Registered row whose member wasn't loaded → name only, no throw.
    expect(resolveParticipantIdentity({ member_id: 'm1', display_name: null }).displayName).toBe(
      'Player'
    );
    // Empty everything.
    expect(
      resolveParticipantIdentity({ member_id: null, display_name: '' }).displayName
    ).toBe('Player');
  });
});
