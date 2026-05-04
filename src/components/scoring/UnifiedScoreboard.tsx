/**
 * @fileoverview UnifiedScoreboard — single live-match scoreboard component
 * that replaces ThreeVThreeScoreboard / FiveVFiveScoreboard / TenSevenScoreboard
 * (Unit 3 of the unified-scoreboard plan,
 * `docs/plans/2026-05-03-001-feat-unified-scoreboard-plan.md`).
 *
 * The component reads ALL its data from the match row (R3 of the plan):
 *   - home_games_won / away_games_won
 *   - home_points_earned / away_points_earned
 *   - home_to_win / home_to_tie / home_to_lose (and away_*)
 *   - system_snapshot.points_calculator + points_calculator_params
 *
 * It never recomputes via legacy helpers (`calculatePoints`,
 * `calculateFargoMatchTotals`, `calculateBCAPoints`). The two-paths-audit-each-
 * other pattern (helpers as the divergence audit's reference impl) survives
 * untouched — this component just stops being one of the paths.
 *
 * Display behavior is driven by:
 *   - `win_condition` ('games' | 'points') — which axis is primary
 *   - `points_calculator` — whether the points axis renders at all
 *     (`'none'` or `null` hides it entirely per R7)
 *   - The active calculator's `displayHints` / `getDisplayHints` — for
 *     calculator-specific cues like the BCA 5v5 milestone marker
 *   - `lineup_size` — the count of player rows (auto-flex per R14)
 *
 * The component never branches on `handicap_type` or `lineup_size === 5` —
 * those would re-introduce the n×m matrix the plan kills. Display behavior
 * is purely composition over `win_condition` × `points_calculator` × params.
 *
 * Tiebreaker rendering stays in `TiebreakerScoreboard.tsx` (separate
 * component, also updated in this branch — Unit 6).
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { MatchEndVerification } from '@/components/scoring/MatchEndVerification';
import { InfoButton } from '@/components/InfoButton';
import { PlayerNameLink } from '@/components/PlayerNameLink';
import { TeamNameLink } from '@/components/TeamNameLink';
import { UserRoundPen } from 'lucide-react';
import { getTeamColors } from './scoreboardColors';
import { getCalculator } from '@/systems/calculators';
import type { DisplayHint } from '@/systems/calculators/types';
import type {
  Lineup,
  HandicapThresholds,
  MatchWithLeagueSettings,
} from '@/types';

// ============================================================================
// Props
// ============================================================================

export interface UnifiedScoreboardProps {
  /** Match data including team info, running totals, threshold trio, system_snapshot. */
  match: MatchWithLeagueSettings;
  /** Home team lineup. */
  homeLineup: Lineup;
  /** Away team lineup. */
  awayLineup: Lineup;
  /** Resolved thresholds for home team (mirror of match.home_to_*, in HandicapThresholds shape). */
  homeThresholds: HandicapThresholds;
  /** Resolved thresholds for away team. */
  awayThresholds: HandicapThresholds;
  /** Home team losses (derived from games array by caller — no losses column on match row). */
  homeLosses: number;
  /** Away team losses. */
  awayLosses: number;
  /** Whether all games are complete — drives MatchEndVerification rendering. */
  allGamesComplete: boolean;
  /** Whether the current user is on the home team — drives swap-player UX. */
  isHomeTeam: boolean;
  /** Verify-completion handler. */
  onVerify: () => void;
  /** Whether verification is in flight. */
  isVerifying?: boolean;
  /** Game type ('8-ball', '9-ball', etc.) — passed through to MatchEndVerification. */
  gameType: string;
  /** Which axis is primary — drives visual emphasis (R9). */
  winCondition: 'games' | 'points';
  /** Number of player rows to render (R14 auto-flex). */
  lineupSize: number;
  /** Get player display name by id. */
  getPlayerDisplayName: (playerId: string) => string;
  /** Get per-player stats (W/L) for the player drawer. */
  getPlayerStats: (
    playerId: string,
    position: number,
    isHomeTeam: boolean,
  ) => { wins: number; losses: number };
  /** Optional swap-player handler (only used when isUserTeam). */
  onSwapPlayer?: (playerId: string, position: number) => void;
  /**
   * Optional per-player points getter. Provided when the active calculator
   * awards per-player points (e.g. `accumulated_per_game`) — caller derives
   * each player's running points total from the games array. When absent,
   * the player drawer omits the per-player points column.
   *
   * Per Ed's framing during review: "if each player earns points then show
   * points; if it's team-based then don't show it." The decision to provide
   * this getter lives at the caller (which knows the active calculator's
   * `kind`), keeping the scoreboard parameter-blind.
   */
  getPlayerPoints?: (
    playerId: string,
    position: number,
    isHomeTeam: boolean,
  ) => number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Resolve the active calculator's display hints to a flat runtime list. Tries
 * the imperative escape hatch first; falls back to the schema-derived form.
 * Returns an empty array when no calculator / no hints are declared.
 */
function resolveDisplayHints(
  calculatorName: string | null | undefined,
  params: unknown,
): DisplayHint[] {
  if (!calculatorName || calculatorName === 'none') return [];
  const calc = getCalculator(calculatorName);
  if (!calc) return [];

  // Imperative escape hatch wins when present (canonical for structural
  // param shapes like accumulated_per_game).
  if (calc.getDisplayHints) {
    const resolvedParams =
      params == null || (typeof params === 'object' && Object.keys(params as object).length === 0)
        ? calc.defaultParams
        : params;
    try {
      return calc.getDisplayHints(resolvedParams as never);
    } catch {
      return [];
    }
  }

  // Schema-derived path: read displayHints, look up each key in params.
  if (calc.displayHints && params && typeof params === 'object') {
    const out: DisplayHint[] = [];
    const paramRecord = params as Record<string, unknown>;
    const hintEntries = Object.entries(calc.displayHints) as Array<
      [string, { role: string; label?: string } | undefined]
    >;
    for (const [key, hint] of hintEntries) {
      if (!hint) continue;
      const value = paramRecord[key];
      if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
        out.push({
          role: hint.role,
          label: hint.label ?? key,
          value,
          paramKey: key,
        });
      }
    }
    return out;
  }

  return [];
}

/**
 * Should the points axis render at all?
 *   - `'none'` sentinel: no
 *   - `null` (legacy snapshot): no
 *   - any other calculator name: yes
 */
function shouldShowPointsAxis(calculatorName: string | null | undefined): boolean {
  return calculatorName != null && calculatorName !== 'none';
}

// ============================================================================
// Team card (inline — single component owns the calculator-driven chrome)
// ============================================================================

interface TeamCardProps {
  teamName: string;
  isHome: boolean;
  wins: number;
  losses: number;
  points: number;
  thresholds: HandicapThresholds;
  lineup: Lineup;
  lineupSize: number;
  showPoints: boolean;
  winCondition: 'games' | 'points';
  hints: DisplayHint[];
  /**
   * Starting-points credit (Fargo points-mode). When > 0, renders inline as
   * a small `+N` next to the primary points number. Null/0/undefined → no
   * badge. Caller passes `match.home_to_tie` (or away).
   */
  startPointsDelta?: number | null;
  isUserTeam: boolean;
  getPlayerDisplayName: (id: string) => string;
  getPlayerStats: (
    playerId: string,
    position: number,
    isHomeTeam: boolean,
  ) => { wins: number; losses: number };
  onSwapPlayer?: (playerId: string, position: number) => void;
  /** Optional per-player points getter (when calculator is per-game). */
  getPlayerPoints?: (
    playerId: string,
    position: number,
    isHomeTeam: boolean,
  ) => number;
}

function TeamCard({
  teamName,
  isHome,
  wins,
  losses,
  points,
  thresholds,
  lineup,
  lineupSize,
  showPoints,
  winCondition,
  hints,
  startPointsDelta,
  isUserTeam,
  getPlayerDisplayName,
  getPlayerStats,
  onSwapPlayer,
  getPlayerPoints,
}: TeamCardProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const colors = getTeamColors(isHome);

  // Auto-flex player list based on lineupSize. Lineup row has player1_id..N
  // fields; we pull the ones up to lineupSize and skip null IDs (incomplete
  // lineups in dev / pre-lock state).
  const players = collectLineupPlayers(lineup, lineupSize);

  // Win-condition-driven size emphasis (R9). Per Ed's design framing
  // 2026-05-04: BOTH wins and points always render side-by-side (unless
  // calculator is 'none'). The win-condition's axis renders larger; the
  // other stays visible at a subordinate size — most matches care about
  // both numbers, the difference is which one decides the match.
  const winsClass = winCondition === 'points' ? 'text-xl' : 'text-3xl';
  const pointsClass = winCondition === 'points' ? 'text-3xl' : 'text-xl';

  return (
    <Card className={`${colors.border} ${colors.bg} p-0`}>
      <div className="text-sm p-2">
        {/* Inline team identity (R8). Tap to toggle drawer + threshold trio
            together (revised 2026-05-04 design: thresholds are bound to the
            drawer state, not a separate chevron toggle). */}
        <button
          onClick={() => setDrawerOpen((v) => !v)}
          className={`text-base font-bold ${colors.headerText} text-center truncate border-b ${colors.borderDark} pb-1 w-full flex items-center justify-center gap-1`}
        >
          <span className="truncate">{teamName}</span>
          <span className="text-xs font-normal opacity-70">·</span>
          <span className="text-xs font-normal opacity-70">{isHome ? 'Home' : 'Away'}</span>
        </button>

        {/* Wins / Points side-by-side. Both always render (unless calculator
            is 'none', in which case the points column collapses). Win-
            condition determines size emphasis but both stay visible — most
            matches care about both numbers. */}
        <div
          className={`grid items-baseline pt-2 ${
            showPoints ? 'grid-cols-2 gap-2' : 'grid-cols-1'
          }`}
        >
          {/* Wins column — `wins/to_win` slash format reads as "0 of 7"
              (LIST_FOR_ED #10 fix). When games_to_win is null (pure points-
              mode with no game target) shows just the wins count. */}
          <div className="flex flex-col items-center">
            <span className={`font-bold ${winsClass} ${colors.accentText}`}>
              {thresholds.games_to_win != null
                ? `${wins}/${thresholds.games_to_win}`
                : formatNumber(wins)}
            </span>
            <span className="text-[10px] text-muted-foreground">Wins</span>
          </div>

          {/* Points column — hidden entirely when calculator is 'none' (R7) */}
          {showPoints && (
            <div className="flex flex-col items-center">
              <div className="flex items-baseline gap-1">
                <span className={`font-bold ${pointsClass} text-foreground`}>
                  {formatNumber(points)}
                </span>
                {/* R22 — Fargo start-points credit. Inline next to the points
                    number for the weaker team only (positive *_to_tie). */}
                {winCondition === 'points' &&
                  startPointsDelta != null &&
                  startPointsDelta > 0 && (
                    <span
                      className="text-[10px] text-muted-foreground bg-background/40 rounded px-1 py-0.5"
                      title="Starting points (handicap credit)"
                    >
                      +{startPointsDelta}
                    </span>
                  )}
              </div>
              <span className="text-[10px] text-muted-foreground">Points</span>
            </div>
          )}
        </div>

        {/* Calculator hints (R6/R17) — schema-derived or escape-hatch */}
        {hints.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {hints.map((hint, i) => (
              <span
                key={`${hint.role}-${hint.paramKey ?? i}`}
                className="text-[10px] text-muted-foreground bg-background/40 rounded px-1.5 py-0.5"
                title={`role: ${hint.role}`}
              >
                {hint.label}: <span className="font-semibold">{String(hint.value)}</span>
              </span>
            ))}
          </div>
        )}

        {/* Threshold trio (drawer-bound — appears with the drawer, hides on
            close). Revised 2026-05-04: replaces the prior chevron-toggle
            pattern. Single tap on the team name reveals BOTH the trio and
            the player drawer. */}
        {drawerOpen && (
          <div className={`flex justify-center gap-3 text-xs text-muted-foreground pt-2 border-t ${colors.borderDark}`}>
            {thresholds.games_to_win != null && (
              <span>
                <span className="font-semibold">{thresholds.games_to_win}</span> win
              </span>
            )}
            {thresholds.games_to_tie != null && (
              <span>
                <span className="font-semibold">{thresholds.games_to_tie}</span> tie
              </span>
            )}
            {thresholds.games_to_lose != null && (
              <span>
                <span className="font-semibold">{thresholds.games_to_lose}</span> lose
              </span>
            )}
          </div>
        )}

        {/* Player drawer (drawer-bound, collapsed by default).
            Per-player points column appears only when the calculator awards
            per-player points (caller passes `getPlayerPoints`). Per Ed's
            framing: "if each player earns points then show points; if it's
            team-based then don't show it." */}
        {drawerOpen && (
          <div className="pt-2">
            <div
              className={`grid gap-2 text-xs ${
                getPlayerPoints
                  ? 'grid-cols-[auto_1fr_auto_auto_auto]'
                  : 'grid-cols-[auto_1fr_auto_auto]'
              }`}
            >
              <div className="font-semibold text-muted-foreground">HC</div>
              <div className="font-semibold text-muted-foreground">Name</div>
              <div className="font-semibold text-muted-foreground text-center">W</div>
              <div className="font-semibold text-muted-foreground text-center">L</div>
              {getPlayerPoints && (
                <div className="font-semibold text-muted-foreground text-center">P</div>
              )}

              {/* Team summary row */}
              <div className="font-semibold text-foreground">
                {sumLineupHandicaps(lineup, lineupSize)}
              </div>
              <div className="font-semibold text-foreground truncate">
                <TeamNameLink teamId={lineup.team_id} teamName={teamName} />
              </div>
              <div className="font-semibold text-foreground text-center">{wins}</div>
              <div className="font-semibold text-foreground text-center">{losses}</div>
              {getPlayerPoints && (
                <div className="font-semibold text-foreground text-center">
                  {formatNumber(points)}
                </div>
              )}

              {/* Player rows — auto-flex by lineupSize */}
              {players.map((player) => {
                const stats = getPlayerStats(player.id, player.position, isHome);
                const playerPoints = getPlayerPoints
                  ? getPlayerPoints(player.id, player.position, isHome)
                  : null;
                const canSwap =
                  isUserTeam && stats.wins === 0 && stats.losses === 0 && !!onSwapPlayer;
                const swapAction = canSwap
                  ? [
                      {
                        label: 'Swap Player',
                        icon: <UserRoundPen className="h-4 w-4 text-purple-600" />,
                        onClick: () => onSwapPlayer?.(player.id, player.position),
                        className:
                          'flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left text-purple-600',
                      },
                    ]
                  : [];
                return (
                  <div key={`row-${player.position}`} className="contents">
                    <div className="text-foreground">{player.handicap ?? '–'}</div>
                    <div className="text-foreground truncate">
                      <PlayerNameLink
                        playerId={player.id}
                        playerName={getPlayerDisplayName(player.id)}
                        customActions={swapAction}
                        hidePlaceholderBadge
                      />
                    </div>
                    <div className="text-center text-foreground">{stats.wins}</div>
                    <div className="text-center text-foreground">{stats.losses}</div>
                    {playerPoints != null && (
                      <div className="text-center text-foreground">
                        {formatNumber(playerPoints)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Pull up to `count` players out of a Lineup row's player1..player5 fields.
 * Skips null IDs (incomplete lineup state). Returns the ones that exist in
 * position order.
 */
function collectLineupPlayers(
  lineup: Lineup,
  count: number,
): Array<{ id: string; handicap: number | null; position: number }> {
  const slots: Array<{
    id: string | null;
    handicap: number | null;
    position: number;
  }> = [
    { id: lineup.player1_id ?? null, handicap: lineup.player1_handicap ?? null, position: 1 },
    { id: lineup.player2_id ?? null, handicap: lineup.player2_handicap ?? null, position: 2 },
    { id: lineup.player3_id ?? null, handicap: lineup.player3_handicap ?? null, position: 3 },
    { id: lineup.player4_id ?? null, handicap: lineup.player4_handicap ?? null, position: 4 },
    { id: lineup.player5_id ?? null, handicap: lineup.player5_handicap ?? null, position: 5 },
  ];
  return slots
    .slice(0, Math.max(0, Math.min(count, slots.length)))
    .filter((s): s is { id: string; handicap: number | null; position: number } => s.id != null);
}

function sumLineupHandicaps(lineup: Lineup, count: number): number {
  return collectLineupPlayers(lineup, count).reduce(
    (sum, p) => sum + (p.handicap ?? 0),
    0,
  );
}

/**
 * Render numbers cleanly — integers as-is, fractionals to one decimal place.
 * Mirrors today's TeamStatsCard rendering rule (BCA 5v5 produces decimals
 * via the milestone bonus; 3v3 and Fargo produce integers).
 */
function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

// ============================================================================
// Top-level component
// ============================================================================

export function UnifiedScoreboard({
  match,
  homeLineup,
  awayLineup,
  homeThresholds,
  awayThresholds,
  homeLosses,
  awayLosses,
  allGamesComplete,
  isHomeTeam,
  onVerify,
  isVerifying = false,
  gameType,
  winCondition,
  lineupSize,
  getPlayerDisplayName,
  getPlayerStats,
  onSwapPlayer,
  getPlayerPoints,
}: UnifiedScoreboardProps) {
  // Match-row source-of-truth reads (R3, R4 contract — never recompute).
  const homeWins = match.home_games_won ?? 0;
  const awayWins = match.away_games_won ?? 0;
  const homePoints = match.home_points_earned ?? 0;
  const awayPoints = match.away_points_earned ?? 0;

  // Snapshot reads — calculator drives display, not handicap_type or lineup_size.
  const snapshot = match.system_snapshot ?? {};
  const calculatorName = (snapshot as { points_calculator?: string | null }).points_calculator;
  const calculatorParams = (snapshot as { points_calculator_params?: unknown }).points_calculator_params ?? {};
  const showPoints = shouldShowPointsAxis(calculatorName);
  const hints = resolveDisplayHints(calculatorName, calculatorParams);

  // R22 — Fargo start-points credit. In points-mode, the credit lives on
  // *_to_tie post Phase 2 Unit 2.1. Whichever side is positive is the weaker
  // team (gets the visible "+N start" badge). Stronger team's *_to_tie is 0
  // → no badge.
  const homeStartPointsDelta =
    winCondition === 'points' ? (match.home_to_tie ?? null) : null;
  const awayStartPointsDelta =
    winCondition === 'points' ? (match.away_to_tie ?? null) : null;

  return (
    <div className="bg-card border-b shadow-sm flex-shrink-0">
      <div className="px-3 py-2">
        {allGamesComplete && (
          <MatchEndVerification
            matchId={match.id}
            homeTeamId={match.home_team_id}
            awayTeamId={match.away_team_id}
            homeTeamName={match.home_team?.team_name || 'Home'}
            awayTeamName={match.away_team?.team_name || 'Away'}
            homeWins={homeWins}
            awayWins={awayWins}
            homeWinThreshold={homeThresholds.games_to_win}
            awayWinThreshold={awayThresholds.games_to_win}
            homeTieThreshold={homeThresholds.games_to_tie}
            awayTieThreshold={awayThresholds.games_to_tie}
            homeVerifiedBy={(match as { home_team_verified_by?: string | null }).home_team_verified_by ?? null}
            awayVerifiedBy={(match as { away_team_verified_by?: string | null }).away_team_verified_by ?? null}
            isHomeTeam={isHomeTeam}
            onVerify={onVerify}
            isVerifying={isVerifying}
            gameType={gameType}
          />
        )}

        {/* Corner info button (R12 — no center "VS" column). */}
        <div className="flex justify-end pb-1">
          <InfoButton title="Scoring Tips">
            <p className="text-sm mb-2">
              <strong>Player Stats:</strong> Click either team name to view individual player
              stats for the lineup. Click again to close.
            </p>
            <p className="text-sm mb-2">
              <strong>Thresholds:</strong> The chevron next to "to win" reveals the full
              tie/lose thresholds (when applicable).
            </p>
            <p className="text-sm">
              <strong>Calculator hints:</strong> Markers like "Milestone bonus" come from the
              league's points calculator. They appear only when the calculator declares them.
            </p>
          </InfoButton>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <TeamCard
            teamName={match.home_team?.team_name || 'Home'}
            isHome={true}
            wins={homeWins}
            losses={homeLosses}
            points={homePoints}
            thresholds={homeThresholds}
            lineup={homeLineup}
            lineupSize={lineupSize}
            showPoints={showPoints}
            winCondition={winCondition}
            hints={hints}
            startPointsDelta={homeStartPointsDelta}
            isUserTeam={isHomeTeam}
            getPlayerDisplayName={getPlayerDisplayName}
            getPlayerStats={getPlayerStats}
            onSwapPlayer={onSwapPlayer}
            getPlayerPoints={getPlayerPoints}
          />
          <TeamCard
            teamName={match.away_team?.team_name || 'Away'}
            isHome={false}
            wins={awayWins}
            losses={awayLosses}
            points={awayPoints}
            thresholds={awayThresholds}
            lineup={awayLineup}
            lineupSize={lineupSize}
            showPoints={showPoints}
            winCondition={winCondition}
            hints={hints}
            startPointsDelta={awayStartPointsDelta}
            isUserTeam={!isHomeTeam}
            getPlayerDisplayName={getPlayerDisplayName}
            getPlayerStats={getPlayerStats}
            onSwapPlayer={onSwapPlayer}
            getPlayerPoints={getPlayerPoints}
          />
        </div>
      </div>
    </div>
  );
}
