/**
 * @fileoverview Exhaustiveness test for `RECOVERY_COPY`.
 *
 * Locks the contract that every `RecoveryReason` union member has a
 * matching copy entry. If a future contributor adds a new reason to
 * the union without populating the map, the TypeScript compiler will
 * already complain at the `Record<RecoveryReason, CopyEntry>` site,
 * but this test makes the contract explicit and catches it faster
 * with a clearer error message.
 *
 * Also pins the basic shape of each entry — every reason has both a
 * non-empty headline and a non-empty body. Empty strings would render
 * blank UI and slip past TypeScript's structural typing.
 */

import { describe, it, expect } from 'vitest';
import { RECOVERY_COPY, type RecoveryReason } from '../MatchTransitionRecovery';

const ALL_REASONS: RecoveryReason[] = [
  'connection',
  'match_not_found',
  'auth_expired',
  'server_error',
  'unknown_status',
];

describe('RECOVERY_COPY', () => {
  it('has an entry for every RecoveryReason', () => {
    for (const reason of ALL_REASONS) {
      expect(RECOVERY_COPY[reason]).toBeDefined();
    }
  });

  it('every entry has a non-empty headline', () => {
    for (const reason of ALL_REASONS) {
      expect(RECOVERY_COPY[reason].headline).toBeTruthy();
      expect(RECOVERY_COPY[reason].headline.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty body', () => {
    for (const reason of ALL_REASONS) {
      expect(RECOVERY_COPY[reason].body).toBeTruthy();
      expect(RECOVERY_COPY[reason].body.length).toBeGreaterThan(0);
    }
  });

  it('headlines are distinct across reasons (no copy collision)', () => {
    const headlines = ALL_REASONS.map((r) => RECOVERY_COPY[r].headline);
    const unique = new Set(headlines);
    expect(unique.size).toBe(headlines.length);
  });
});
