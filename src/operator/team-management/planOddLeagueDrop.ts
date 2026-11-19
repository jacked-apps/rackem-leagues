/**
 * @fileoverview Plan the schedule change when a team drops mid-season from a
 * league that ALREADY has a BYE (odd team count). Pure: no database access.
 *
 * Ed's rule (2026-11-19), chosen because it disrupts the fewest teams: for each
 * remaining week, the team that was due to play the dropped team (X) and the
 * team that had the bye (Y) play EACH OTHER instead. Every other match is
 * untouched. Concretely, the BYE's match becomes X vs Y and the dropped team's
 * match is deleted. No "dropped team vs BYE" match is kept, because the daily
 * auto-forfeit sweep would hand the dropped (still-captained) team a win.
 * Home/away: see pickHomeTeam.
 *
 * The dropped team's PLAYED matches are never touched (its history stays). If
 * its match is unplayed but that week's bye was already settled (a makeup still
 * pending), the match moves onto the BYE instead, so its opponent gets the
 * forfeit win from the sweep.
 */

import { pickHomeTeam } from './pickHomeTeam';

/** A season match, reduced to what the plan needs. */
export interface DropPlanMatch {
  id: string;
  weekId: string;
  /** The week's date (YYYY-MM-DD); weeks are processed in this order. */
  weekDate: string;
  homeTeamId: string;
  awayTeamId: string;
  /** True when the match is already played or under way (never changed). */
  started: boolean;
}

export interface DropPlan {
  /** BYE matches rewritten as a real match between the two leftover teams. */
  updates: { matchId: string; weekId: string; homeTeamId: string; awayTeamId: string }[];
  /** The dropped team's unplayed matches, removed. */
  deleteMatchIds: string[];
  /** Dropped-team matches moved onto the BYE (no open bye match that week to pair with). */
  rewireToBye: { matchId: string; weekId: string }[];
}

/**
 * @param matches - Every match of the season (played and unplayed)
 * @param droppedTeamId - The team leaving the league
 * @param byeTeamId - The season's existing BYE team
 * @param standingsOrder - Team ids from first place to last
 * @param random - Coin flip for pickHomeTeam's final tiebreak
 */
export function planOddLeagueDrop(
  matches: DropPlanMatch[],
  droppedTeamId: string,
  byeTeamId: string,
  standingsOrder: string[],
  random: () => number = Math.random,
): DropPlan {
  const plan: DropPlan = { updates: [], deleteMatchIds: [], rewireToBye: [] };
  const has = (m: DropPlanMatch, t: string) => m.homeTeamId === t || m.awayTeamId === t;
  const other = (m: DropPlanMatch, t: string) => (m.homeTeamId === t ? m.awayTeamId : m.homeTeamId);
  const sideOf = (m: DropPlanMatch, t: string) => (m.homeTeamId === t ? 'home' : 'away') as 'home' | 'away';

  // The schedule as it will stand: real matches only, updated as weeks are planned.
  const live = new Map(matches.filter((m) => !has(m, droppedTeamId) && !has(m, byeTeamId)).map((m) => [m.id, m]));
  const homePlayed = (t: string) => matches.filter((m) => m.started && m.homeTeamId === t).length;
  const homeScheduled = (t: string) => [...live.values()].filter((m) => m.homeTeamId === t).length;
  const rank = (t: string) => { const i = standingsOrder.indexOf(t); return i === -1 ? standingsOrder.length : i; };

  const weeks = [...new Set([...matches].sort((a, b) => a.weekDate.localeCompare(b.weekDate)).map((m) => m.weekId))];
  for (const weekId of weeks) {
    const inWeek = matches.filter((m) => m.weekId === weekId);
    const dMatch = inWeek.find((m) => has(m, droppedTeamId));
    if (!dMatch || dMatch.started) continue; // no match, or a played one (history stays)
    // Dropped team was already on the bye this week: just remove that dead match.
    if (other(dMatch, droppedTeamId) === byeTeamId) { plan.deleteMatchIds.push(dMatch.id); continue; }
    const bMatch = inWeek.find((m) => has(m, byeTeamId));
    // No open bye match to pair with: the opponent takes the forfeit win instead.
    if (!bMatch || bMatch.started) { plan.rewireToBye.push({ matchId: dMatch.id, weekId }); continue; }

    const x = other(dMatch, droppedTeamId);
    const y = other(bMatch, byeTeamId);
    const candidate = (t: string, m: DropPlanMatch) => ({
      teamId: t, side: sideOf(m, t), homePlayed: homePlayed(t), homeScheduled: homeScheduled(t), standingsIndex: rank(t),
    });
    const sides = pickHomeTeam(candidate(x, dMatch), candidate(y, bMatch), random);
    plan.updates.push({ matchId: bMatch.id, weekId, ...sides });
    plan.deleteMatchIds.push(dMatch.id);
    live.set(bMatch.id, { ...bMatch, ...sides });
  }
  return plan;
}
