/**
 * @fileoverview Phase 1 Unit 1.1 verification: status-aware tier-1 lock.
 *
 * Verifies the trigger from
 * `supabase/migrations/20260429000000_replace_tier1_lock_with_status_aware.sql`:
 *
 *   - Allows UPDATE of preferences.handicap_type and preferences.lineup_size
 *     while ALL the league's matches are status='scheduled'.
 *   - Blocks the same UPDATEs once at least one match in the league has
 *     status != 'scheduled' (in_progress, completed, vacated, forfeited).
 *
 * Replaces the permanent-lock behavior of the previous trigger
 * (20260418000002_lock_tier1_preferences.sql) — pre-season tier-1 edits
 * are now allowed; post-first-match they're blocked, protecting in-flight
 * match data from retroactive scoring changes.
 *
 * The trigger uses pg_advisory_xact_lock for race-safety against the
 * lifecycle hook that transitions matches scheduled → in_progress
 * (Phase 5 will add the matching lock acquisition there). This spec
 * doesn't directly exercise the race; it locks the gross block/allow
 * behavior.
 */

import { test, expect } from '@playwright/test';
import { getStorageState } from '../fixtures/users';
import { createMatchReadyForLineup } from '../fixtures/factories';
import { getServiceClient } from '../fixtures/serviceClient';

// storageState required by Playwright config but unused for this spec
test.use({ storageState: getStorageState('captain-1') });

test.describe('Phase 1 Unit 1.1: status-aware tier-1 lock', () => {
  test('PRE-MATCH: handicap_type can be changed while all matches are scheduled', async () => {
    const supabase = getServiceClient();
    const { league } = await createMatchReadyForLineup({
      homeCaptain: 'captain-1',
      awayCaptain: 'captain-2',
      leagueOpts: {
        teamFormat: '5_man',
        lineupSize: 3,
        maxRosterSize: 5,
        gameGeneration: 'double_round_robin',
        handicapType: 'points',
      },
    });

    // The factory creates a match in 'scheduled' status. The new trigger
    // should ALLOW this UPDATE because no match is past scheduled yet.
    const { error } = await supabase
      .from('preferences')
      .update({ handicap_type: 'percentage' })
      .eq('entity_type', 'league')
      .eq('entity_id', league.id);

    expect(error).toBeNull();

    // Verify the change actually persisted
    const { data: updated } = await supabase
      .from('preferences')
      .select('handicap_type')
      .eq('entity_type', 'league')
      .eq('entity_id', league.id)
      .single();
    expect(updated?.handicap_type).toBe('percentage');
  });

  test('PRE-MATCH: lineup_size can be changed while all matches are scheduled', async () => {
    const supabase = getServiceClient();
    const { league } = await createMatchReadyForLineup({
      homeCaptain: 'captain-1',
      awayCaptain: 'captain-2',
      leagueOpts: {
        teamFormat: '5_man',
        lineupSize: 3,
        maxRosterSize: 5,
        gameGeneration: 'double_round_robin',
        handicapType: 'points',
      },
    });

    const { error } = await supabase
      .from('preferences')
      .update({ lineup_size: 4 })
      .eq('entity_type', 'league')
      .eq('entity_id', league.id);

    expect(error).toBeNull();

    const { data: updated } = await supabase
      .from('preferences')
      .select('lineup_size')
      .eq('entity_type', 'league')
      .eq('entity_id', league.id)
      .single();
    expect(updated?.lineup_size).toBe(4);
  });

  test('POST-MATCH: handicap_type is BLOCKED once any match is past scheduled', async () => {
    const supabase = getServiceClient();
    const { league, match } = await createMatchReadyForLineup({
      homeCaptain: 'captain-1',
      awayCaptain: 'captain-2',
      leagueOpts: {
        teamFormat: '5_man',
        lineupSize: 3,
        maxRosterSize: 5,
        gameGeneration: 'double_round_robin',
        handicapType: 'points',
      },
    });

    // Transition the match out of 'scheduled' state.
    const { error: matchUpdateErr } = await supabase
      .from('matches')
      .update({ status: 'in_progress' })
      .eq('id', match.id);
    expect(matchUpdateErr).toBeNull();

    // Now the tier-1 lock should fire. handicap_type change is rejected.
    const { error } = await supabase
      .from('preferences')
      .update({ handicap_type: 'percentage' })
      .eq('entity_type', 'league')
      .eq('entity_id', league.id);

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/Cannot change handicap_type/i);

    // And the value should NOT have changed
    const { data: prefs } = await supabase
      .from('preferences')
      .select('handicap_type')
      .eq('entity_type', 'league')
      .eq('entity_id', league.id)
      .single();
    expect(prefs?.handicap_type).toBe('points');
  });

  test('POST-MATCH: lineup_size is BLOCKED once any match is past scheduled', async () => {
    const supabase = getServiceClient();
    const { league, match } = await createMatchReadyForLineup({
      homeCaptain: 'captain-1',
      awayCaptain: 'captain-2',
      leagueOpts: {
        teamFormat: '5_man',
        lineupSize: 3,
        maxRosterSize: 5,
        gameGeneration: 'double_round_robin',
        handicapType: 'points',
      },
    });

    await supabase
      .from('matches')
      .update({ status: 'completed' })
      .eq('id', match.id);

    const { error } = await supabase
      .from('preferences')
      .update({ lineup_size: 4 })
      .eq('entity_type', 'league')
      .eq('entity_id', league.id);

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/Cannot change lineup_size/i);
  });

  test('POST-MATCH: non-tier-1 fields (e.g. game_generation) remain editable even after first match', async () => {
    // Status-aware lock targets ONLY handicap_type and lineup_size.
    // Other modular preferences (game_generation, etc.) should remain
    // editable per the existing scope of the trigger.
    const supabase = getServiceClient();
    const { league, match } = await createMatchReadyForLineup({
      homeCaptain: 'captain-1',
      awayCaptain: 'captain-2',
      leagueOpts: {
        teamFormat: '5_man',
        lineupSize: 3,
        maxRosterSize: 5,
        gameGeneration: 'double_round_robin',
        handicapType: 'points',
      },
    });

    await supabase
      .from('matches')
      .update({ status: 'in_progress' })
      .eq('id', match.id);

    // game_generation is a tier-2 field per the modular-league plan;
    // it should NOT be blocked by the tier-1 trigger.
    const { error } = await supabase
      .from('preferences')
      .update({ game_generation: 'single_round_robin' })
      .eq('entity_type', 'league')
      .eq('entity_id', league.id);

    expect(error).toBeNull();
  });

  test('ORG-LEVEL preferences: tier-1 lock does NOT apply (only entity_type=league)', async () => {
    // The trigger explicitly returns NEW for entity_type != 'league',
    // so org-level templates remain freely editable. Verify the trigger
    // doesn't accidentally over-block.
    const supabase = getServiceClient();
    // Find or create an org-level prefs row for the foundation org.
    const E2E_ORG_ID = 'e0e0e0e0-cccc-cccc-cccc-cccccccccccc';

    // Upsert an org-level prefs row
    const { error: upsertErr } = await supabase.from('preferences').upsert(
      {
        entity_type: 'organization',
        entity_id: E2E_ORG_ID,
        handicap_type: 'points',
        lineup_size: 3,
      },
      { onConflict: 'entity_type,entity_id' }
    );
    expect(upsertErr).toBeNull();

    // Now change handicap_type at the org level — should be allowed.
    const { error } = await supabase
      .from('preferences')
      .update({ handicap_type: 'percentage' })
      .eq('entity_type', 'organization')
      .eq('entity_id', E2E_ORG_ID);

    expect(error).toBeNull();

    // Reset for cleanliness (org-level data is shared across tests)
    await supabase
      .from('preferences')
      .update({ handicap_type: 'points' })
      .eq('entity_type', 'organization')
      .eq('entity_id', E2E_ORG_ID);
  });

  test('NULL → value initial population is allowed (wizard upsert pattern)', async () => {
    // The trigger_create_league_preferences trigger creates an empty
    // preferences row when a league is INSERTed. The wizard then upserts
    // tier-1 values via UPDATE (NULL → real value). This must continue
    // to work — no in-flight matches yet, AND the OLD value is NULL.
    const supabase = getServiceClient();
    const E2E_ORG_ID = 'e0e0e0e0-cccc-cccc-cccc-cccccccccccc';
    const E2E_VENUE_ID = 'e0e0e0e0-dddd-dddd-dddd-dddddddddddd';

    // Insert a bare league row WITHOUT going through createLeague (which
    // upserts modular fields immediately). This leaves preferences with
    // NULL modular fields after the AFTER-INSERT trigger fires.
    const { data: league, error: leagueErr } = await supabase
      .from('leagues')
      .insert({
        organization_id: E2E_ORG_ID,
        game_type: 'eight_ball',
        day_of_week: 'tuesday',
        division: `null-init-test-${Date.now()}`,
        team_format: '5_man',
        league_start_date: new Date().toISOString().slice(0, 10),
        status: 'active',
      })
      .select()
      .single();
    expect(leagueErr).toBeNull();

    await supabase.from('league_venues').insert({ league_id: league!.id, venue_id: E2E_VENUE_ID });

    // Now UPDATE the auto-created prefs row with real values. NULL → value
    // must succeed.
    const { error: prefsErr } = await supabase
      .from('preferences')
      .update({ handicap_type: 'points', lineup_size: 3 })
      .eq('entity_type', 'league')
      .eq('entity_id', league!.id);
    expect(prefsErr).toBeNull();
  });
});
