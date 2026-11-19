/**
 * @fileoverview Plan the schedule change when a team drops mid-season from a
 * league that ALREADY has a BYE (odd team count). Pure: no database access.
 *
 * Ed's "hybrid" (2026-11-19): each remaining week, the team that was due to
 * play the dropped team (X) and the team that had the bye (Y) need new
 * opponents. Usually they play each other (2 teams change); when that would
 * pile repeats onto one pair, one more match that night is pulled in and the
 * four teams re-paired instead. See chooseRepairing. The BYE's match (and the
 * pulled match) are rewritten with the new pairs; the dropped team's match is
 * deleted. No "dropped team vs BYE" match is kept, because the daily
 * auto-forfeit sweep would hand the dropped (still-captained) team a win.
 * Home/away for every new pair: see pickHomeTeam.
 *
 * The dropped team's PLAYED matches are never touched (its history stays). If
 * its match is unplayed but that week's bye was already settled (a makeup still
 * pending), the match moves onto the BYE instead, so its opponent gets the
 * forfeit win from the sweep.
 */

import { pickHomeTeam } from './pickHomeTeam';
import { chooseRepairing, pairKey, type PairCounts } from './chooseRepairing';

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
  /** Matches rewritten with a new pairing (the BYE's match, and any pulled-in match). */
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
  // Season-long meetings per pair (played + still to play), kept current as weeks are planned.
  const counts: PairCounts = new Map();
  const bump = (a: string, b: string, by: number) => counts.set(pairKey(a, b), (counts.get(pairKey(a, b)) ?? 0) + by);
  for (const m of live.values()) bump(m.homeTeamId, m.awayTeamId, 1);

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
    const pullable = inWeek.filter((m) => !m.started && live.has(m.id));
    const choice = chooseRepairing(x, y, pullable, counts);
    const pulled = choice.pulled && pullable.find((m) => m.id === choice.pulled!.id);

    // Each team keeps the side it had in its ORIGINAL match this week, for pickHomeTeam.
    const origin = new Map<string, DropPlanMatch>([[x, dMatch], [y, bMatch]]);
    if (pulled) {
      origin.set(pulled.homeTeamId, pulled).set(pulled.awayTeamId, pulled);
      bump(pulled.homeTeamId, pulled.awayTeamId, -1);
    }
    const candidate = (t: string) => ({
      teamId: t, side: sideOf(origin.get(t)!, t), homePlayed: homePlayed(t), homeScheduled: homeScheduled(t), standingsIndex: rank(t),
    });
    // First pair takes over the BYE's match row; a second pair takes the pulled match's row.
    choice.pairs.forEach(([a, b], i) => {
      const row = i === 0 ? bMatch : pulled!;
      const sides = pickHomeTeam(candidate(a), candidate(b), random);
      plan.updates.push({ matchId: row.id, weekId, ...sides });
      live.set(row.id, { ...row, ...sides });
      bump(a, b, 1);
    });
    plan.deleteMatchIds.push(dMatch.id);
  }
  return plan;
}
