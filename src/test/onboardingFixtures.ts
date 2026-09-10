/**
 * @fileoverview Fixtures for the onboarding-cascade DB tests.
 *
 * The onboarding suites all need the same shape: a team whose captain is a
 * PLACEHOLDER (a member with no `user_id`), sitting in an organization that
 * has staff, with roster room for a self-add.
 *
 * The dev seed contains no such team — every seeded captain is a registered
 * user and every roster is full — so those suites used to search for one,
 * find nothing, and fail on assertions that never reached the code under
 * test. Building the shape here makes each suite independent of whatever
 * happens to be in the shared database, which is also what stops them
 * fighting each other over the same rows.
 *
 * Every suite that uses this must call {@link destroyOnboardingFixture} in
 * `afterAll`, or the next run inherits the team.
 */

import { executeSql } from './dbTestUtils';

/** Ids created by {@link createOnboardingFixture}, plus the staff it found. */
export interface OnboardingFixture {
  teamId: string;
  joinToken: string;
  /** The placeholder captain — a member with no `user_id`. */
  captainMemberId: string;
  /** Placeholder roster spots, claimable by a joining player. */
  placeholderMemberIds: string[];
  organizationId: string;
  /** Org staff member, and the auth user behind them. Both pre-existing. */
  staffMemberId: string;
  staffUserId: string;
  /** A REGISTERED player already on the team — the "already_member" case. */
  onTeamMemberId: string;
  onTeamUserId: string;
  /** True when the captain is ours to delete, false when it is the staff member. */
  createdCaptain: boolean;
}

/**
 * Who captains the fixture team.
 *
 * `placeholder` — an unregistered member, for the suites that check what
 * happens when a team has no real captain to act.
 * `staff` — the organization's staff member, for the suites that need a
 * captain with authority to approve.
 */
export type FixtureCaptain = 'placeholder' | 'staff';

/** Insert a placeholder member: no `user_id`, and no email so no invite fires. */
async function createPlaceholder(label: string): Promise<string> {
  const rows = await executeSql(
    `INSERT INTO public.members (first_name, last_name, city, state)
     VALUES ($1, 'Fixture', 'Testville', 'TX')
     RETURNING id`,
    [label]
  );
  return rows[0].id;
}

/**
 * Build a placeholder-captain team with roster room.
 *
 * Reuses an existing organization that already has staff with a linked auth
 * user, because minting auth users from raw SQL needs matching
 * `auth.identities` rows and non-NULL token columns — a known trap, and not
 * one worth re-entering for a fixture.
 *
 * @returns The created ids, for use and for teardown.
 * @throws If the seed has no staffed organization with a season to hang a
 *   team from — in which case the local database needs reseeding, and saying
 *   so beats a confusing assertion failure later.
 */
export async function createOnboardingFixture(
  options: { captain?: FixtureCaptain } = {}
): Promise<OnboardingFixture> {
  const captainKind: FixtureCaptain = options.captain ?? 'placeholder';
  const staff = await executeSql(
    `SELECT s.organization_id, s.member_id, m.user_id
       FROM public.organization_staff s
       JOIN public.members m ON m.id = s.member_id
      WHERE m.user_id IS NOT NULL
      LIMIT 1`
  );
  if (staff.length === 0) {
    throw new Error(
      'Onboarding fixtures need an organization with staff linked to an auth user. ' +
        'Apply supabase/seed_test_users.sql to the local database.'
    );
  }

  const place = await executeSql(
    `SELECT l.id AS league_id, se.id AS season_id
       FROM public.leagues l
       JOIN public.seasons se ON se.league_id = l.id
      WHERE l.organization_id = $1
      LIMIT 1`,
    [staff[0].organization_id]
  );
  if (place.length === 0) {
    throw new Error('Onboarding fixtures need a league with a season in the staffed organization.');
  }

  // A placeholder captain is created; a staff captain is the existing staff
  // member, who already has the authority the approving suites exercise.
  const captainMemberId =
    captainKind === 'staff' ? staff[0].member_id : await createPlaceholder('FixtureCaptain');

  // roster_size is NOT NULL, so room is expressed as "seats above the number
  // filled" — 8 seats against 2 placeholders leaves space for a self-add.
  const team = await executeSql(
    `INSERT INTO public.teams (season_id, league_id, team_name, roster_size, captain_id)
     VALUES ($1, $2, 'Fixture Placeholder Team', 8, $3)
     RETURNING id, join_token`,
    [place[0].season_id, place[0].league_id, captainMemberId]
  );

  const placeholderMemberIds: string[] = [];
  for (const label of ['FixtureOpenA', 'FixtureOpenB']) {
    const memberId = await createPlaceholder(label);
    await executeSql(
      `INSERT INTO public.team_players (team_id, member_id, season_id)
       VALUES ($1, $2, $3)`,
      [team[0].id, memberId, place[0].season_id]
    );
    placeholderMemberIds.push(memberId);
  }

  // One registered player on the roster. Suites need somebody who is already
  // a member to prove the RPC turns them away, and a team of nothing but
  // placeholders cannot express that.
  const onTeam = await executeSql(
    `SELECT id, user_id FROM public.members
      WHERE user_id IS NOT NULL AND id <> $1
      ORDER BY id
      LIMIT 1`,
    [staff[0].member_id]
  );
  if (onTeam.length === 0) {
    throw new Error('Onboarding fixtures need a second member linked to an auth user.');
  }
  await executeSql(
    `INSERT INTO public.team_players (team_id, member_id, season_id, status)
     VALUES ($1, $2, $3, 'active')`,
    [team[0].id, onTeam[0].id, place[0].season_id]
  );

  return {
    teamId: team[0].id,
    joinToken: team[0].join_token,
    captainMemberId,
    placeholderMemberIds,
    organizationId: staff[0].organization_id,
    staffMemberId: staff[0].member_id,
    staffUserId: staff[0].user_id,
    onTeamMemberId: onTeam[0].id,
    onTeamUserId: onTeam[0].user_id,
    createdCaptain: captainKind !== 'staff',
  };
}

/** Remove everything {@link createOnboardingFixture} made, children first. */
export async function destroyOnboardingFixture(fixture: OnboardingFixture | null): Promise<void> {
  if (!fixture) return;

  // Never delete a captain we did not create — a staff-captained fixture
  // borrows a real member, and removing them would gut the seed.
  const members = fixture.createdCaptain
    ? [fixture.captainMemberId, ...fixture.placeholderMemberIds]
    : [...fixture.placeholderMemberIds];

  await executeSql(`DELETE FROM public.team_join_requests WHERE team_id = $1`, [fixture.teamId]);
  await executeSql(`DELETE FROM public.team_players WHERE team_id = $1`, [fixture.teamId]);
  // The captain reference blocks deleting the member while the team stands.
  await executeSql(`DELETE FROM public.teams WHERE id = $1`, [fixture.teamId]);
  await executeSql(`DELETE FROM public.invite_tokens WHERE member_id = ANY($1::uuid[])`, [members]);
  await executeSql(`DELETE FROM public.members WHERE id = ANY($1::uuid[])`, [members]);
}
