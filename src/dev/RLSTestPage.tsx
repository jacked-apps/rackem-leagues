/**
 * @fileoverview RLS Testing Page (Development Only)
 *
 * Manual testing for RLS INSERT/DELETE policies using real TanStack hooks.
 * Tests work without RLS first, then we'll add RLS and update pass/fail criteria.
 *
 * IMPORTANT: Only accessible in development mode.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useCreateMember, useDeleteMember } from '@/api/hooks/useMemberMutations';
import { useCreateVenue, useDeleteVenue } from '@/api/hooks/useVenueMutations';
import {
  useCreateChampionshipDate,
  useDeleteChampionshipDate,
} from '@/api/hooks/useChampionshipDateMutations';
import {
  useCreateOperatorBlackoutPreference,
  useDeleteOperatorBlackoutPreference,
} from '@/api/hooks/useOperatorBlackoutPreferenceMutations';
import { useCreateTeam, useDeleteTeam } from '@/api/hooks/useTeamMutations';
import { useCreateLeague, useDeleteLeague } from '@/api/hooks/useLeagueMutations';
import { useCreatePreference, useDeletePreference } from '@/api/hooks/usePreferenceMutations';
import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';

/**
 * Test result structure showing INSERT/DELETE outcomes
 */
interface TestResult {
  testName: string;           // e.g., "Create Member"
  insertSuccess: boolean;     // Did INSERT work?
  insertError?: string;       // Error message if INSERT failed
  insertedId?: string;        // Record ID if INSERT succeeded
  deleteSuccess: boolean;     // Did DELETE work?
  deleteError?: string;       // Error message if DELETE failed
  testPassed: boolean;        // Overall pass/fail (for now: both INSERT and DELETE must succeed)
}

export default function RLSTestPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testing, setTesting] = useState(false);

  // TanStack mutation hooks
  const createMember = useCreateMember();
  const deleteMember = useDeleteMember();
  const createVenue = useCreateVenue();
  const deleteVenue = useDeleteVenue();
  const createChampionshipDate = useCreateChampionshipDate();
  const deleteChampionshipDate = useDeleteChampionshipDate();
  const createOperatorBlackoutPreference = useCreateOperatorBlackoutPreference();
  const deleteOperatorBlackoutPreference = useDeleteOperatorBlackoutPreference();
  const createTeam = useCreateTeam();
  const deleteTeam = useDeleteTeam();
  const createLeague = useCreateLeague();
  const deleteLeague = useDeleteLeague();
  const createPreference = useCreatePreference();
  const deletePreference = useDeletePreference();

  /**
   * Add a test result to the display
   */
  const addTestResult = (result: TestResult) => {
    setTestResults(prev => [result, ...prev]); // Newest first
  };

  /**
   * Clear all test results
   */
  const clearResults = () => {
    setTestResults([]);
  };

  /**
   * Test 1: Member INSERT/DELETE
   *
   * Uses useCreateMember and useDeleteMember hooks.
   * Currently expects both to succeed (no RLS blocking).
   */
  const testMemberInsertDelete = async () => {
    setTesting(true);
    const result: TestResult = {
      testName: 'Create Member',
      insertSuccess: false,
      deleteSuccess: false,
      testPassed: false,
    };

    try {
      // INSERT
      const timestamp = Date.now();
      const member = await createMember.mutateAsync({
        first_name: 'Test',
        last_name: `User${timestamp}`,
        phone: '555-0100',
        email: `test${timestamp}@example.com`,
        address: '123 Test St',
        city: 'Test City',
        state: 'TX',
        zip_code: '12345',
        date_of_birth: '1990-01-01',
        system_player_number: 999000 + (timestamp % 1000),
      });

      result.insertSuccess = true;
      result.insertedId = member.id;

      // DELETE
      try {
        await deleteMember.mutateAsync({ memberId: member.id });
        result.deleteSuccess = true;
      } catch (deleteErr: any) {
        result.deleteSuccess = false;
        result.deleteError = deleteErr.message;
      }
    } catch (insertErr: any) {
      result.insertSuccess = false;
      result.insertError = insertErr.message;
      result.deleteSuccess = false; // Can't delete if INSERT failed
    }

    // Test passes if both INSERT and DELETE succeeded
    result.testPassed = result.insertSuccess && result.deleteSuccess;
    addTestResult(result);
    setTesting(false);
  };

  /**
   * Test 2: Venue INSERT/DELETE
   *
   * Uses useCreateVenue and useDeleteVenue hooks.
   * Currently expects both to succeed (no RLS blocking).
   */
  const testVenueInsertDelete = async () => {
    setTesting(true);
    const result: TestResult = {
      testName: 'Create Venue',
      insertSuccess: false,
      deleteSuccess: false,
      testPassed: false,
    };

    try {
      // First get an organization for FK constraint
      const { data: orgs } = await (await import('@/supabaseClient')).supabase
        .from('organizations')
        .select('id')
        .limit(1);

      if (!orgs || orgs.length === 0) {
        result.insertError = 'No organization found';
        addTestResult(result);
        setTesting(false);
        return;
      }

      // INSERT
      const timestamp = Date.now();
      const venue = await createVenue.mutateAsync({
        organizationId: orgs[0].id,
        name: `Test Venue ${timestamp}`,
        street_address: '123 Test St',
        city: 'Test City',
        state: 'TX',
        zip_code: '12345',
        phone: '555-0100',
        // Table numbers as arrays - length = count, values = table numbers
        bar_box_table_numbers: [1, 2, 3, 4],
        eight_foot_table_numbers: [],
        regulation_table_numbers: [5, 6, 7, 8],
      });

      result.insertSuccess = true;
      result.insertedId = venue.id;

      // DELETE
      try {
        await deleteVenue.mutateAsync({ venueId: venue.id });
        result.deleteSuccess = true;
      } catch (deleteErr: any) {
        result.deleteSuccess = false;
        result.deleteError = deleteErr.message;
      }
    } catch (insertErr: any) {
      result.insertSuccess = false;
      result.insertError = insertErr.message;
      result.deleteSuccess = false;
    }

    // Test passes if both INSERT and DELETE succeeded
    result.testPassed = result.insertSuccess && result.deleteSuccess;
    addTestResult(result);
    setTesting(false);
  };

  /**
   * Test 3: Championship Date + Operator Blackout Preference (LINKED TABLES)
   *
   * This test verifies the relationship between two tables:
   * 1. Creates a championship_date_options record
   * 2. Creates an operator_blackout_preferences record that references it
   * 3. Deletes the preference
   * 4. Deletes the championship date
   *
   * Tests both INSERT/DELETE operations and the FK relationship.
   */
  const testChampionshipWithPreference = async () => {
    setTesting(true);
    const result: TestResult = {
      testName: 'Championship Date + Blackout Preference',
      insertSuccess: false,
      deleteSuccess: false,
      testPassed: false,
    };

    let championshipId: string | undefined;
    let preferenceId: string | undefined;

    try {
      // First, get an organization ID for the preference
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id')
        .limit(1);

      if (!orgs || orgs.length === 0) {
        result.insertError = 'No organization found';
        addTestResult(result);
        setTesting(false);
        return;
      }

      const organizationId = orgs[0].id;

      // STEP 1: INSERT championship_date_options
      const currentYear = new Date().getFullYear();
      const championship = await createChampionshipDate.mutateAsync({
        organization: 'BCA',
        year: currentYear,
        start_date: `${currentYear}-07-15`,
        end_date: `${currentYear}-07-20`,
        vote_count: 1,
        dev_verified: false,
      });

      championshipId = championship.id;

      // STEP 2: INSERT operator_blackout_preferences (references championship)
      const preference = await createOperatorBlackoutPreference.mutateAsync({
        organization_id: organizationId,
        preference_type: 'championship',
        preference_action: 'blackout',
        championship_id: championshipId,
        auto_apply: false,
      });

      preferenceId = preference.id;
      result.insertSuccess = true;
      result.insertedId = `Champ: ${championshipId.slice(0, 8)}..., Pref: ${preferenceId.slice(0, 8)}...`;

      // DELETE (must delete preference first due to FK constraint)
      try {
        // Delete preference first
        await deleteOperatorBlackoutPreference.mutateAsync({ preferenceId });

        // Then delete championship date
        await deleteChampionshipDate.mutateAsync({ championshipDateId: championshipId });

        result.deleteSuccess = true;
      } catch (deleteErr: any) {
        result.deleteSuccess = false;
        result.deleteError = deleteErr.message;
      }
    } catch (insertErr: any) {
      result.insertSuccess = false;
      result.insertError = insertErr.message;
      result.deleteSuccess = false;

      // Attempt cleanup if we got partway through
      try {
        if (preferenceId) {
          await deleteOperatorBlackoutPreference.mutateAsync({ preferenceId });
        }
        if (championshipId) {
          await deleteChampionshipDate.mutateAsync({ championshipDateId: championshipId });
        }
      } catch (cleanupErr) {
        logger.error('Cleanup failed', { error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr) });
      }
    }

    // Test passes if both INSERT and DELETE succeeded
    result.testPassed = result.insertSuccess && result.deleteSuccess;
    addTestResult(result);
    setTesting(false);
  };

  /**
   * Test 4: Team INSERT/DELETE (requires captain)
   *
   * Tests team creation with validation:
   * - Team name is required
   * - Captain is required
   * - Captain must be in roster
   * - Creates team_players roster records
   *
   * DELETE is actually a soft delete (sets status to 'withdrawn')
   */
  const testTeamInsertDelete = async () => {
    setTesting(true);
    const result: TestResult = {
      testName: 'Create Team (with captain requirement)',
      insertSuccess: false,
      deleteSuccess: false,
      testPassed: false,
    };

    let teamId: string | undefined;

    try {
      // Get prerequisites: season, league, and member for captain
      const { data: seasons } = await supabase
        .from('seasons')
        .select('id, league_id')
        .limit(1);

      if (!seasons || seasons.length === 0) {
        result.insertError = 'No season found';
        addTestResult(result);
        setTesting(false);
        return;
      }

      const seasonId = seasons[0].id;
      const leagueId = seasons[0].league_id;

      // Get a member to be captain
      const { data: members } = await supabase
        .from('members')
        .select('id')
        .limit(1);

      if (!members || members.length === 0) {
        result.insertError = 'No member found for captain';
        addTestResult(result);
        setTesting(false);
        return;
      }

      const captainId = members[0].id;

      // INSERT team
      const timestamp = Date.now();
      const team = await createTeam.mutateAsync({
        seasonId,
        leagueId,
        captainId,
        teamName: `zzzDelete Me Test ${timestamp}`,
        rosterSize: 5,
        homeVenueId: null,
        rosterPlayerIds: [captainId], // Captain must be in roster
      });

      teamId = team.id;
      result.insertSuccess = true;
      result.insertedId = teamId.slice(0, 8) + '...';

      // DELETE (soft delete - sets status to 'withdrawn')
      try {
        await deleteTeam.mutateAsync({ teamId });
        result.deleteSuccess = true;
      } catch (deleteErr: any) {
        result.deleteSuccess = false;
        result.deleteError = deleteErr.message;
      }
    } catch (insertErr: any) {
      result.insertSuccess = false;
      result.insertError = insertErr.message;
      result.deleteSuccess = false;

      // Cleanup if INSERT succeeded but something else failed
      if (teamId) {
        try {
          await deleteTeam.mutateAsync({ teamId });
        } catch (cleanupErr) {
          logger.error('Cleanup failed', { error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr) });
        }
      }
    }

    // Test passes if both INSERT and DELETE succeeded
    result.testPassed = result.insertSuccess && result.deleteSuccess;
    addTestResult(result);
    setTesting(false);
  };

  /**
   * Test 5: League INSERT/DELETE
   *
   * Tests league creation:
   * - Requires organization_id
   * - Requires game type, day of week, team format, etc.
   * - Simple single-table INSERT/DELETE
   */
  const testLeagueInsertDelete = async () => {
    setTesting(true);
    const result: TestResult = {
      testName: 'Create League',
      insertSuccess: false,
      deleteSuccess: false,
      testPassed: false,
    };

    let leagueId: string | undefined;

    try {
      // Get an organization for FK constraint
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id')
        .limit(1);

      if (!orgs || orgs.length === 0) {
        result.insertError = 'No organization found';
        addTestResult(result);
        setTesting(false);
        return;
      }

      const organizationId = orgs[0].id;

      // INSERT league
      const timestamp = Date.now();
      const today = new Date().toISOString().split('T')[0];

      const league = await createLeague.mutateAsync({
        operatorId: organizationId,
        gameType: 'eight_ball',
        dayOfWeek: 'monday',
        handicapVariant: 'standard',
        teamHandicapVariant: 'standard',
        leagueStartDate: today,
        division: `zzzDelete Me League ${timestamp}`,
      });

      leagueId = league.id;
      result.insertSuccess = true;
      result.insertedId = leagueId.slice(0, 8) + '...';

      // DELETE
      try {
        await deleteLeague.mutateAsync({ leagueId });
        result.deleteSuccess = true;
      } catch (deleteErr: any) {
        result.deleteSuccess = false;
        result.deleteError = deleteErr.message;
      }
    } catch (insertErr: any) {
      result.insertSuccess = false;
      result.insertError = insertErr.message;
      result.deleteSuccess = false;

      // Cleanup if INSERT succeeded but something else failed
      if (leagueId) {
        try {
          await deleteLeague.mutateAsync({ leagueId });
        } catch (cleanupErr) {
          logger.error('Cleanup failed', { error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr) });
        }
      }
    }

    // Test passes if both INSERT and DELETE succeeded
    result.testPassed = result.insertSuccess && result.deleteSuccess;
    addTestResult(result);
    setTesting(false);
  };

  /**
   * Test 6: Preferences INSERT/DELETE (league-level)
   *
   * Tests preference creation at league level (overrides for specific league).
   * Uses a test league created just for this test to avoid touching real preferences.
   *
   * Note: We use league-level instead of organization-level to avoid deleting
   * real organization preferences that might be in use.
   */
  const testPreferenceInsertDelete = async () => {
    setTesting(true);
    const result: TestResult = {
      testName: 'Create Preference (League-level)',
      insertSuccess: false,
      deleteSuccess: false,
      testPassed: false,
    };

    let preferenceId: string | undefined;
    let testLeagueId: string | undefined;

    try {
      // Create a test league to attach preference to (avoids touching real org preferences)
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id')
        .limit(1);

      if (!orgs || orgs.length === 0) {
        result.insertError = 'No organization found';
        addTestResult(result);
        setTesting(false);
        return;
      }

      const timestamp = Date.now();
      const today = new Date().toISOString().split('T')[0];

      // Create test league
      const testLeague = await createLeague.mutateAsync({
        operatorId: orgs[0].id,
        gameType: 'eight_ball',
        dayOfWeek: 'monday',
        handicapVariant: 'standard',
        teamHandicapVariant: 'standard',
        leagueStartDate: today,
        division: `zzzDelete Me Pref Test ${timestamp}`,
      });

      testLeagueId = testLeague.id;

      // INSERT league-level preference (overrides org defaults)
      const preference = await createPreference.mutateAsync({
        entity_type: 'league',
        entity_id: testLeagueId,
        handicap_variant: 'reduced',
        team_handicap_variant: 'standard',
        game_history_limit: 150,
        golden_break_counts_as_win: false,
      });

      preferenceId = preference.id;
      result.insertSuccess = true;
      result.insertedId = preferenceId.slice(0, 8) + '...';

      // DELETE preference
      try {
        await deletePreference.mutateAsync({ preferenceId });
        result.deleteSuccess = true;
      } catch (deleteErr: any) {
        result.deleteSuccess = false;
        result.deleteError = deleteErr.message;
      }

      // Cleanup test league
      if (testLeagueId) {
        try {
          await deleteLeague.mutateAsync({ leagueId: testLeagueId });
        } catch (cleanupErr) {
          logger.error('League cleanup failed', { error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr) });
        }
      }
    } catch (insertErr: any) {
      result.insertSuccess = false;
      result.insertError = insertErr.message;
      result.deleteSuccess = false;

      // Cleanup if INSERT succeeded but something else failed
      if (preferenceId) {
        try {
          await deletePreference.mutateAsync({ preferenceId });
        } catch (cleanupErr) {
          logger.error('Preference cleanup failed', { error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr) });
        }
      }

      if (testLeagueId) {
        try {
          await deleteLeague.mutateAsync({ leagueId: testLeagueId });
        } catch (cleanupErr) {
          logger.error('League cleanup failed', { error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr) });
        }
      }
    }

    // Test passes if both INSERT and DELETE succeeded
    result.testPassed = result.insertSuccess && result.deleteSuccess;
    addTestResult(result);
    setTesting(false);
  };

  /**
   * Render a single test result card
   */
  const renderTestResult = (result: TestResult, index: number) => (
    <Card key={index} className={`border-2 ${result.testPassed ? 'border-green-500' : 'border-red-500'}`}>
      <CardContent className="p-4">
        <div className="space-y-2">
          {/* Test Name */}
          <h4 className="font-semibold text-lg">{result.testName}</h4>

          {/* INSERT Result */}
          <div className="flex items-center gap-2">
            <span className="font-medium">INSERT:</span>
            {result.insertSuccess ? (
              <span className="text-green-600">✅ Success {result.insertedId && `(ID: ${result.insertedId.slice(0, 8)}...)`}</span>
            ) : (
              <span className="text-red-600">❌ Failed</span>
            )}
          </div>
          {result.insertError && (
            <div className="text-sm text-red-600 ml-16">{result.insertError}</div>
          )}

          {/* DELETE Result */}
          <div className="flex items-center gap-2">
            <span className="font-medium">DELETE:</span>
            {!result.insertSuccess ? (
              <span className="text-gray-500">⊗ Skipped (no record to delete)</span>
            ) : result.deleteSuccess ? (
              <span className="text-green-600">✅ Success</span>
            ) : (
              <span className="text-red-600">❌ Failed</span>
            )}
          </div>
          {result.deleteError && (
            <div className="text-sm text-red-600 ml-16">{result.deleteError}</div>
          )}

          {/* Test Pass/Fail */}
          <div className="mt-2 pt-2 border-t">
            {result.testPassed ? (
              <div className="text-green-600 font-semibold">✅ TEST PASSED</div>
            ) : (
              <div className="text-red-600 font-semibold">❌ TEST FAILED</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            🧪 RLS Testing Page (Development Only)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Testing INSERT/DELETE operations using real TanStack Query hooks.
            Currently testing without RLS - both operations should succeed.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Test Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Test 1: Member</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Tests INSERT and DELETE for members table
              </p>
              <Button
                loadingText="Testing..."
                isLoading={testing}
                onClick={testMemberInsertDelete}
                disabled={testing}
                className="w-full"
              >
                Test Member INSERT/DELETE
              </Button>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Test 2: Venue</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Tests INSERT and DELETE for venues table (has generated column)
              </p>
              <Button
                loadingText="Testing..."
                isLoading={testing}
                onClick={testVenueInsertDelete}
                disabled={testing}
                className="w-full"
              >
                Test Venue INSERT/DELETE
              </Button>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Test 3: Championship + Preference</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Tests linked tables with FK relationship (championship_date_options → operator_blackout_preferences)
              </p>
              <Button
                loadingText="Testing..."
                isLoading={testing}
                onClick={testChampionshipWithPreference}
                disabled={testing}
                className="w-full"
              >
                Test Championship + Preference
              </Button>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Test 4: Team</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Tests team creation with captain requirement. Must have team name and captain in roster.
              </p>
              <Button
                loadingText="Testing..."
                isLoading={testing}
                onClick={testTeamInsertDelete}
                disabled={testing}
                className="w-full"
              >
                Test Team INSERT/DELETE
              </Button>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Test 5: League</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Tests league creation. Requires organization, game type, day of week, team format.
              </p>
              <Button
                loadingText="Testing..."
                isLoading={testing}
                onClick={testLeagueInsertDelete}
                disabled={testing}
                className="w-full"
              >
                Test League INSERT/DELETE
              </Button>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Test 6: Preferences</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Tests league-level preferences (overrides). Creates test league to avoid touching real preferences.
              </p>
              <Button
                loadingText="Testing..."
                isLoading={testing}
                onClick={testPreferenceInsertDelete}
                disabled={testing}
                className="w-full"
              >
                Test Preference INSERT/DELETE
              </Button>
            </div>
          </div>

          {/* Results Display */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Test Results</h3>
              {testResults.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearResults}>
                  Clear All
                </Button>
              )}
            </div>

            {testResults.length === 0 ? (
              <Card className="bg-muted">
                <CardContent className="p-8 text-center text-muted-foreground">
                  No tests run yet. Click a test button above to start.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {testResults.map((result, index) => renderTestResult(result, index))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
