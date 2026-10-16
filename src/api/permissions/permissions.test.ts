/**
 * @fileoverview Unit tests for the pure permission check layer.
 *
 * Because `permissions.ts` is pure (no React, no DB, no clock), we can assert
 * the full behavior of the authorization rules here — the additive/most-
 * permissive-wins semantics (O10), league scoping (O3), the owner-only powers
 * (O8/O9), and the developer master key (D7). This is the acceptance test for
 * slice 1: if these pass, every consumer built on top asks a correct question.
 */

import { describe, expect, it } from 'vitest';
import {
  can,
  hasOperatorAccess,
  POSITION_PERMISSIONS,
  type PermissionContext,
  type StaffGrant,
} from './permissions';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';
const LEAGUE_A = 'league-a';
const LEAGUE_B = 'league-b';

/** Build a context with the given grants and (default) no master key. */
function ctx(grants: StaffGrant[], isDeveloper = false): PermissionContext {
  return { grants, isDeveloper };
}

describe('can()', () => {
  describe('developer master key (D7)', () => {
    it('satisfies every action in any scope, with no grants at all', () => {
      const dev = ctx([], true);
      expect(can(dev, 'access_operator_features', { orgId: ORG })).toBe(true);
      expect(can(dev, 'delete_organization', { orgId: ORG })).toBe(true);
      expect(can(dev, 'transfer_ownership', { orgId: OTHER_ORG, leagueId: LEAGUE_A })).toBe(true);
    });
  });

  describe('owner bundle (O8/O9)', () => {
    const owner = ctx([{ organizationId: ORG, position: 'owner', leagueId: null }]);

    it('holds every permission in its own org', () => {
      for (const action of POSITION_PERMISSIONS.owner) {
        expect(can(owner, action, { orgId: ORG })).toBe(true);
      }
    });

    it('holds nothing in a different org', () => {
      expect(can(owner, 'access_operator_features', { orgId: OTHER_ORG })).toBe(false);
    });
  });

  describe('admin bundle (O9 — operational, not deletion/transfer/billing)', () => {
    const admin = ctx([{ organizationId: ORG, position: 'admin', leagueId: null }]);

    it('can access operator features and manage staff', () => {
      expect(can(admin, 'access_operator_features', { orgId: ORG })).toBe(true);
      expect(can(admin, 'manage_staff', { orgId: ORG })).toBe(true);
    });

    it('cannot delete, transfer, or touch payments', () => {
      expect(can(admin, 'delete_organization', { orgId: ORG })).toBe(false);
      expect(can(admin, 'transfer_ownership', { orgId: ORG })).toBe(false);
      expect(can(admin, 'access_payments', { orgId: ORG })).toBe(false);
    });
  });

  describe('league scope (O3)', () => {
    const scoped = ctx([{ organizationId: ORG, position: 'league_rep', leagueId: LEAGUE_A }]);

    it('grants access within its own league', () => {
      expect(can(scoped, 'access_operator_features', { orgId: ORG, leagueId: LEAGUE_A })).toBe(true);
    });

    it('denies access in a different league of the same org', () => {
      expect(can(scoped, 'access_operator_features', { orgId: ORG, leagueId: LEAGUE_B })).toBe(false);
    });

    it('an org-wide grant satisfies any league question (empty scope = every league)', () => {
      const orgWide = ctx([{ organizationId: ORG, position: 'league_rep', leagueId: null }]);
      expect(can(orgWide, 'access_operator_features', { orgId: ORG, leagueId: LEAGUE_A })).toBe(true);
      expect(can(orgWide, 'access_operator_features', { orgId: ORG, leagueId: LEAGUE_B })).toBe(true);
    });
  });

  describe('additive / most-permissive-wins (O10)', () => {
    it('takes the union of an org-wide grant and a league-scoped grant', () => {
      const both = ctx([
        { organizationId: ORG, position: 'league_rep', leagueId: LEAGUE_A },
        { organizationId: ORG, position: 'admin', leagueId: null },
      ]);
      // The admin grant is org-wide, so manage_staff applies even when asking
      // about league B, which the league_rep grant alone would deny.
      expect(can(both, 'manage_staff', { orgId: ORG, leagueId: LEAGUE_B })).toBe(true);
    });
  });

  it('denies an unknown-scope member everything', () => {
    const nobody = ctx([]);
    expect(can(nobody, 'access_operator_features', { orgId: ORG })).toBe(false);
  });
});

describe('hasOperatorAccess()', () => {
  it('is true for a developer with no grants', () => {
    expect(hasOperatorAccess(ctx([], true))).toBe(true);
  });

  it('is true for any staff grant', () => {
    expect(hasOperatorAccess(ctx([{ organizationId: ORG, position: 'league_rep', leagueId: LEAGUE_A }]))).toBe(true);
  });

  it('is false for a plain player (no grants, no master key)', () => {
    expect(hasOperatorAccess(ctx([]))).toBe(false);
  });
});
