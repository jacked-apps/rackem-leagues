// @vitest-environment jsdom
//
// jsdom env for consistency with the other messaging DB-backed tests.
// This file uses raw SQL via pg.Pool only, so the happy-dom Content-Type
// bug doesn't directly bite — staying on jsdom keeps the suite uniform.
/**
 * @fileoverview Tests for Unit 15 auto-rename propagation triggers
 *
 * Migration: supabase/migrations/20260517000003_messaging_phase1_unit15_auto_rename_propagation.sql
 *
 * Covers two triggers:
 *
 *   1. teams.team_name UPDATE → matching team_chat.title (when title is
 *      not user-edited).
 *   2. leagues.division/day_of_week UPDATE → captains_chat.title for
 *      every season belonging to this league (when title not user-edited).
 *
 * Plus the negative cases:
 *   - Non-rename UPDATEs (no column change) → trigger no-ops.
 *   - User-edited titles (title_user_edited_at IS NOT NULL) → trigger
 *     respects the captain's custom name and leaves it alone.
 *
 * Run: pnpm test:run src/__tests__/database/messaging-phase1-unit15-auto-rename
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { executeSql } from '@/test/dbTestUtils';

let teamId: string;
let seasonId: string;
let leagueId: string;
let originalTeamName: string;
let originalDivision: string | null;
let originalDayOfWeek: string;

beforeAll(async () => {
  // Find a real seeded team in an active-season league.
  const rows = await executeSql<{
    team_id: string;
    team_name: string;
    season_id: string;
    league_id: string;
    division: string | null;
    day_of_week: string;
  }>(`
    SELECT t.id AS team_id, t.team_name, t.season_id, l.id AS league_id,
           l.division, l.day_of_week
    FROM teams t
    JOIN seasons s ON s.id = t.season_id
    JOIN leagues l ON l.id = s.league_id
    WHERE s.status = 'active'
    ORDER BY t.team_name
    LIMIT 1
  `);
  if (rows.length === 0) {
    throw new Error('Unit 15 test needs at least one team in an active season');
  }
  teamId = rows[0].team_id;
  originalTeamName = rows[0].team_name;
  seasonId = rows[0].season_id;
  leagueId = rows[0].league_id;
  originalDivision = rows[0].division;
  originalDayOfWeek = rows[0].day_of_week;
});

afterAll(async () => {
  // Restore original values so this test doesn't leave the dev DB
  // permanently mutated for the next run.
  if (teamId) {
    await executeSql(`UPDATE teams SET team_name = $1 WHERE id = $2`, [
      originalTeamName,
      teamId,
    ]);
  }
  if (leagueId) {
    await executeSql(
      `UPDATE leagues SET division = $1, day_of_week = $2 WHERE id = $3`,
      [originalDivision, originalDayOfWeek, leagueId],
    );
  }
});

beforeEach(async () => {
  // Clear any user-edit timestamp leftover from a prior test in this file.
  await executeSql(`
    UPDATE conversations
    SET title_user_edited_at = NULL
    WHERE auto_managed = TRUE
      AND (
        (scope_type = 'team' AND scope_id IN (SELECT id FROM teams WHERE id = $1))
        OR (scope_type = 'season' AND scope_id IN (SELECT id FROM seasons WHERE league_id = $2))
      )
  `, [teamId, leagueId]);
  // Reset to original names so the trigger has something to flip back.
  await executeSql(`UPDATE teams SET team_name = $1 WHERE id = $2`, [
    originalTeamName,
    teamId,
  ]);
  await executeSql(
    `UPDATE leagues SET division = $1, day_of_week = $2 WHERE id = $3`,
    [originalDivision, originalDayOfWeek, leagueId],
  );
  // Restore the team chat title and captains chat titles to match the
  // auto-pattern (which the rename triggers expect to find as the
  // starting state).
  await executeSql(`
    UPDATE conversations c
    SET title = t.team_name
    FROM teams t
    WHERE c.scope_type = 'team' AND c.scope_id = t.id
      AND t.id = $1
      AND c.conversation_type = 'team_chat'
  `, [teamId]);
  await executeSql(`
    UPDATE conversations c
    SET title = 'Captains — ' || COALESCE(l.division, l.day_of_week, 'League')
    FROM seasons s
    JOIN leagues l ON l.id = s.league_id
    WHERE c.scope_type = 'season' AND c.scope_id = s.id
      AND c.conversation_type = 'captains_chat'
      AND l.id = $1
  `, [leagueId]);
});

describe('Unit 15 — teams.team_name rename → team_chat title', () => {
  it('propagates the new team name to the matching team_chat', async () => {
    await executeSql(`UPDATE teams SET team_name = 'Reef Sharks' WHERE id = $1`, [
      teamId,
    ]);

    const rows = await executeSql<{ title: string }>(
      `SELECT title FROM conversations WHERE scope_type = 'team' AND scope_id = $1 AND auto_managed = TRUE AND conversation_type = 'team_chat'`,
      [teamId],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].title).toBe('Reef Sharks');
  });

  it('does NOT fire when an unrelated column is updated', async () => {
    // Update a non-name column on teams (status). Title should NOT change.
    const before = await executeSql<{ title: string }>(
      `SELECT title FROM conversations WHERE scope_type = 'team' AND scope_id = $1 AND conversation_type = 'team_chat'`,
      [teamId],
    );
    const beforeTitle = before[0].title;

    await executeSql(`UPDATE teams SET status = status WHERE id = $1`, [teamId]);

    const after = await executeSql<{ title: string }>(
      `SELECT title FROM conversations WHERE scope_type = 'team' AND scope_id = $1 AND conversation_type = 'team_chat'`,
      [teamId],
    );
    expect(after[0].title).toBe(beforeTitle);
  });

  it('does NOT overwrite a user-edited title (title_user_edited_at IS NOT NULL)', async () => {
    // Captain has renamed the chat — mark title_user_edited_at and set a custom title.
    await executeSql(`
      UPDATE conversations
      SET title = 'Captain''s Custom Name',
          title_user_edited_at = NOW()
      WHERE scope_type = 'team' AND scope_id = $1 AND conversation_type = 'team_chat'
    `, [teamId]);

    // Now rename the team — the trigger should NOT touch the user-edited title.
    await executeSql(`UPDATE teams SET team_name = 'Reef Sharks' WHERE id = $1`, [
      teamId,
    ]);

    const rows = await executeSql<{ title: string }>(
      `SELECT title FROM conversations WHERE scope_type = 'team' AND scope_id = $1 AND conversation_type = 'team_chat'`,
      [teamId],
    );
    expect(rows[0].title).toBe("Captain's Custom Name");
  });
});

describe('Unit 15 — leagues.division/day_of_week rename → captains_chat title', () => {
  it('propagates a division rename to every captains_chat in every season of this league', async () => {
    await executeSql(
      `UPDATE leagues SET division = 'New Division Name' WHERE id = $1`,
      [leagueId],
    );

    const rows = await executeSql<{ title: string }>(`
      SELECT c.title
      FROM conversations c
      JOIN seasons s ON s.id = c.scope_id
      WHERE c.scope_type = 'season'
        AND c.conversation_type = 'captains_chat'
        AND c.auto_managed = TRUE
        AND s.league_id = $1
    `, [leagueId]);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.title).toBe('Captains — New Division Name');
    }
  });

  it('falls back to day_of_week when division is set to NULL', async () => {
    await executeSql(
      `UPDATE leagues SET division = NULL WHERE id = $1`,
      [leagueId],
    );

    const rows = await executeSql<{ title: string }>(`
      SELECT c.title
      FROM conversations c
      JOIN seasons s ON s.id = c.scope_id
      WHERE c.scope_type = 'season'
        AND c.conversation_type = 'captains_chat'
        AND c.auto_managed = TRUE
        AND s.league_id = $1
    `, [leagueId]);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.title).toBe(`Captains — ${originalDayOfWeek}`);
    }
  });

  it('does NOT overwrite a user-edited captains_chat title', async () => {
    await executeSql(`
      UPDATE conversations c
      SET title = 'Custom Captains Title',
          title_user_edited_at = NOW()
      FROM seasons s
      WHERE c.scope_type = 'season' AND c.scope_id = s.id
        AND c.conversation_type = 'captains_chat'
        AND s.league_id = $1
    `, [leagueId]);

    await executeSql(
      `UPDATE leagues SET division = 'Whatever' WHERE id = $1`,
      [leagueId],
    );

    const rows = await executeSql<{ title: string }>(`
      SELECT c.title
      FROM conversations c
      JOIN seasons s ON s.id = c.scope_id
      WHERE c.scope_type = 'season'
        AND c.conversation_type = 'captains_chat'
        AND c.auto_managed = TRUE
        AND s.league_id = $1
    `, [leagueId]);

    for (const row of rows) {
      expect(row.title).toBe('Custom Captains Title');
    }
  });
});
