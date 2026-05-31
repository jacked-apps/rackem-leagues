/**
 * @fileoverview Query: what teams need a re-up answer from this captain?
 *
 * Drives the modal-show decision in `useCaptainReupPrompt`. Returns
 * one entry per team that ALL of these are true for:
 *   - current user is the captain
 *   - team's season ends within the next 21 days (and isn't already
 *     fully completed past the 7-day grace window)
 *   - no submitted answer exists yet
 *   - no active dismissal exists (cleared by the match-start trigger
 *     when the captain's team plays its next match)
 *
 * Each entry includes the team's eligible-captain roster so the form
 * can pre-populate the captain-change dropdown without a second
 * round-trip.
 */

import { supabase } from '@/supabaseClient';
import type { PartialMember } from '@/types/member';
import type { CaptainReupModalTeam } from '@/components/reup/CaptainReupModal';

/**
 * Returns the list of teams the captain needs to re-up for. Empty
 * array = no modal should show.
 */
export async function getCaptainReupPrompt(
  captainId: string,
): Promise<CaptainReupModalTeam[]> {
  // 1. Find teams where this user is captain + season ends in the
  //    re-up window. We pull a wide-ish window then filter client-side
  //    so the date math is consistent with the trigger logic.
  const now = new Date();
  const windowStart = new Date(now.getTime());
  windowStart.setDate(windowStart.getDate() - 7); // 7-day post-end grace
  const windowEnd = new Date(now.getTime());
  windowEnd.setDate(windowEnd.getDate() + 21); // last 3 weeks heads-up

  const { data: teams, error } = await supabase
    .from('teams')
    .select(
      `id, team_name, captain_id, season_id,
       season:seasons!season_id(id, end_date, status),
       team_players(member_id, members(id, first_name, last_name, system_player_number, bca_member_number))`,
    )
    .eq('captain_id', captainId)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to load captain re-up prompt: ${error.message}`);
  }

  const candidates = (teams ?? []).filter((t: any) => {
    const season = Array.isArray(t.season) ? t.season[0] : t.season;
    if (!season?.end_date) return false;
    if (season.status !== 'active') return false; // upcoming/completed don't qualify
    const endDate = new Date(season.end_date);
    return endDate >= windowStart && endDate <= windowEnd;
  });

  if (candidates.length === 0) return [];

  // 2. Look up any existing re-up responses for these (season, team)
  //    pairs to filter out already-submitted-or-dismissed ones.
  const seasonIds = [...new Set(candidates.map((t: any) => t.season_id))];
  const teamIds = candidates.map((t: any) => t.id);

  const { data: existing, error: existingErr } = await supabase
    .from('season_reup_responses')
    .select('season_id, team_id, submitted_at, dismissed_at')
    .in('season_id', seasonIds)
    .in('team_id', teamIds);

  if (existingErr) {
    throw new Error(
      `Failed to load existing re-up responses: ${existingErr.message}`,
    );
  }

  const byKey = new Map<string, { submitted_at: string | null; dismissed_at: string | null }>();
  for (const row of existing ?? []) {
    byKey.set(`${row.season_id}:${row.team_id}`, {
      submitted_at: row.submitted_at,
      dismissed_at: row.dismissed_at,
    });
  }

  // 3. Filter: keep teams where there's no submitted answer AND no
  //    active dismissal. Map to the shape the modal expects.
  return candidates
    .filter((t: any) => {
      const key = `${t.season_id}:${t.id}`;
      const row = byKey.get(key);
      if (!row) return true; // no row → definitely show
      if (row.submitted_at) return false; // answered → don't show
      if (row.dismissed_at) return false; // dismissed and not cleared → don't show
      return true;
    })
    .map((t: any): CaptainReupModalTeam => {
      const rosterRaw = (t.team_players ?? []) as { members: any }[];
      const eligibleCaptains: PartialMember[] = rosterRaw
        .map((p) => (Array.isArray(p.members) ? p.members[0] : p.members))
        .filter((m): m is NonNullable<typeof m> => !!m)
        .map((m) => ({
          id: m.id,
          first_name: m.first_name,
          last_name: m.last_name,
          system_player_number: m.system_player_number,
          bca_member_number: m.bca_member_number,
        }));

      return {
        seasonId: t.season_id,
        teamId: t.id,
        teamName: t.team_name,
        currentCaptainId: t.captain_id,
        eligibleCaptains,
      };
    });
}
