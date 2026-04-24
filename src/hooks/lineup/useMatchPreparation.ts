/**
 * @fileoverview Hook for match preparation and auto-navigation
 *
 * Handles the automatic match preparation when both lineups are locked.
 * Only the HOME team performs the preparation to avoid race conditions.
 * Creates game rows and calculates handicap thresholds.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { useUpdateMatch } from '@/api/hooks';
import { calculateHandicapThresholds } from '@/utils/calculateHandicapThresholds';
import { generateGameOrder } from '@/utils/gameOrder';
import { fargo5v5 } from '@/systems/fargo5v5';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import type { SystemOverrides } from '@/types/systemOverrides';
import type { PrepBlockedReason } from '@/utils/lineup';

export function usePreparationStatus() {
  const [isPreparingMatch, setIsPreparingMatch] = useState(false);
  const [preparationMessage, setPreparationMessage] = useState('');
  return { isPreparingMatch, setIsPreparingMatch, preparationMessage, setPreparationMessage };
}

interface MatchPreparationParams {
  lineupLocked: boolean;
  opponentLineup: any;
  matchId: string | undefined;
  matchData: any;
  isHomeTeam: boolean;
  lineupSize: number;
  handicapType: string;
  /** Resolved per-league dial overrides. Used by Fargo threshold compute. */
  systemOverrides?: SystemOverrides;
  /**
   * Discriminated reason for blocking match preparation. When non-null, the
   * effect short-circuits — the UI renders the corresponding waiting state.
   * Supersedes the prior `fargoNegotiationBlocking` flag and covers all
   * blocking conditions (Step 1 completeness, sub resolution, Fargo).
   */
  blockedReason?: PrepBlockedReason;
  player1Id: string;
  player2Id: string;
  player3Id: string;
  player1Handicap: number;
  player2Handicap: number;
  player3Handicap: number;
  player4Id?: string; // 5v5 only
  player5Id?: string; // 5v5 only
  player4Handicap?: number; // 5v5 only
  player5Handicap?: number; // 5v5 only
  setIsPreparingMatch?: (preparing: boolean) => void;
  setPreparationMessage?: (message: string) => void;
  refetchLineups?: () => Promise<any>;
  refetchGames?: () => Promise<any>;
}

export function useMatchPreparation(params: MatchPreparationParams) {
  const {
    lineupLocked,
    opponentLineup,
    matchId,
    matchData,
    isHomeTeam,
    lineupSize,
    handicapType,
    systemOverrides,
    blockedReason,
    player1Id,
    player2Id,
    player3Id,
    player1Handicap,
    player2Handicap,
    player3Handicap,
    player4Id,
    player5Id,
    player4Handicap,
    player5Handicap,
    setIsPreparingMatch,
    setPreparationMessage,
    refetchLineups,
    refetchGames,
  } = params;

  const navigate = useNavigate();
  const updateMatchMutation = useUpdateMatch();
  const matchPreparedRef = useRef(false);

  // Auto-navigate to scoring page when both lineups are locked - useEffect MUST be before early returns
  // IMPORTANT: Only HOME team prepares the match to avoid race conditions
  useEffect(() => {
    // Short-circuit whenever the caller has a non-null blockedReason. The
    // UI renders the corresponding waiting state (Step 1 banner / modal,
    // Fargo card, etc.) instead of preparing the match.
    if (blockedReason !== null && blockedReason !== undefined) return;
    if (lineupLocked && opponentLineup?.locked && !matchPreparedRef.current) {
      // Only home team prepares the match data to avoid both teams doing it simultaneously
      if (!isHomeTeam) {
        const awayTeamNavigate = async () => {
          matchPreparedRef.current = true;
          setIsPreparingMatch?.(true);

          // STEP 1: Verify both lineups are actually locked with FRESH data
          setPreparationMessage?.('Verifying lineups are locked...');
          if (!refetchLineups) {
            logger.error('refetchLineups not available', { matchId });
            setIsPreparingMatch?.(false);
            matchPreparedRef.current = false;
            return;
          }

          let bothLineupsLocked = false;
          let attempts = 0;
          const maxAttempts = 20; // 10 seconds max

          while (!bothLineupsLocked && attempts < maxAttempts) {
            const { data: freshLineups } = await refetchLineups();

            if (freshLineups &&
                freshLineups.homeLineup?.locked &&
                freshLineups.awayLineup?.locked) {
              bothLineupsLocked = true;
            } else {
              attempts++;
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          if (!bothLineupsLocked) {
            logger.error('Timeout: Both lineups not locked', { matchId });
            setIsPreparingMatch?.(false);
            matchPreparedRef.current = false;
            return;
          }

          // STEP 2: Check if this is tiebreaker or regular mode with FRESH data
          setPreparationMessage?.('Checking match type...');
          let isTiebreaker = false;
          if (refetchGames) {
            const { data: existingGames } = await refetchGames();
            isTiebreaker = existingGames && existingGames.length > 0;
          }

          // STEP 3: For regular matches, wait for home team to create games
          if (!isTiebreaker) {
            setPreparationMessage?.('Waiting for match setup...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          // STEP 4: Final verification before navigation
          setPreparationMessage?.('Final verification...');
          await new Promise(resolve => setTimeout(resolve, 500));

          setIsPreparingMatch?.(false);
          navigate(`/match/${matchId}/score`);
        };

        awayTeamNavigate();
        return;
      }

      const prepareMatchAndNavigate = async () => {
        if (!matchId || !matchData || !opponentLineup) return;

        setIsPreparingMatch?.(true);

        try {
          matchPreparedRef.current = true;

          // STEP 1: Verify both lineups are actually locked with FRESH data
          setPreparationMessage?.('Verifying lineups are locked...');
          if (!refetchLineups) {
            logger.error('refetchLineups not available', { matchId });
            setIsPreparingMatch?.(false);
            matchPreparedRef.current = false;
            return;
          }

          let bothLineupsLocked = false;
          let attempts = 0;
          const maxAttempts = 20; // 10 seconds max

          while (!bothLineupsLocked && attempts < maxAttempts) {
            const { data: freshLineups } = await refetchLineups();

            if (freshLineups &&
                freshLineups.homeLineup?.locked &&
                freshLineups.awayLineup?.locked) {
              bothLineupsLocked = true;
            } else {
              attempts++;
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          if (!bothLineupsLocked) {
            logger.error('Timeout: Both lineups not locked', { matchId });
            setIsPreparingMatch?.(false);
            matchPreparedRef.current = false;
            return;
          }

          // STEP 2: Check if this is tiebreaker or regular mode with FRESH data
          setPreparationMessage?.('Checking match type...');
          if (!refetchGames) {
            logger.error('refetchGames not available', { matchId });
            setIsPreparingMatch?.(false);
            matchPreparedRef.current = false;
            return;
          }

          const { data: existingGames } = await refetchGames();
          const isTiebreaker = existingGames && existingGames.length > 0;

          // STEP 3: If tiebreaker mode, verify games exist and navigate
          if (isTiebreaker) {
            setPreparationMessage?.('Final verification...');
            await new Promise(resolve => setTimeout(resolve, 500));

            setIsPreparingMatch?.(false);
            navigate(`/match/${matchId}/score`);
            return;
          }

          // STEP 4: Regular match - create games and thresholds
          // Build current user's lineup object from state
          // Supports both 3v3 (player1-3) and 5v5 (player1-5)
          const myLineup: any = {
            player1_id: player1Id,
            player1_handicap: player1Handicap,
            player2_id: player2Id,
            player2_handicap: player2Handicap,
            player3_id: player3Id,
            player3_handicap: player3Handicap,
          };

          // Add player4/5 based on actual lineup size
          if (lineupSize >= 4) {
            myLineup.player4_id = player4Id || null;
            myLineup.player4_handicap = player4Handicap || 0;
          }
          if (lineupSize >= 5) {
            myLineup.player5_id = player5Id || null;
            myLineup.player5_handicap = player5Handicap || 0;
          }

          // Calculate and save handicap thresholds.
          //
          // BCA systems (points, percentage): compute games-to-win/tie/lose
          // from the existing chart lookup; write all six threshold columns.
          //
          // Fargo system: the start-points value is NOT computed here — it
          // has already been agreed on by both captains via the start-points
          // negotiation flow (Unit 11c). We just read the confirmed value
          // out of `matches.fargo_start_points` and copy it to the weaker
          // team's `home_games_to_win` / `away_games_to_win`. The weaker
          // team is determined structurally from the locked lineup ratings
          // (not from the agreed number, which captains may have overridden
          // to match BCA's FargoRate app).
          if (handicapType === 'fargo') {
            setPreparationMessage?.('Saving Fargo start points...');

            // Re-derive weaker team from the locked lineups so we know
            // which side receives the agreed start-points value.
            const homeLineup = isHomeTeam ? myLineup : opponentLineup;
            const awayLineup = isHomeTeam ? opponentLineup : myLineup;

            const gatherRatings = (lineup: any): number[] => {
              const out: number[] = [];
              for (let i = 1; i <= lineupSize; i++) {
                const rating = Number(lineup?.[`player${i}_handicap`]);
                if (Number.isFinite(rating) && rating > 0) out.push(rating);
              }
              return out;
            };

            const homeRatings = gatherRatings(homeLineup);
            const awayRatings = gatherRatings(awayLineup);

            // Default: use the confirmed value from the match row. Fall
            // back to a live compute if the negotiation never set one
            // (defensive; shouldn't happen because match prep only runs
            // once both confirms are present, which requires a value).
            let startPointsValue: number | null =
              matchData?.fargo_start_points ?? null;
            let weakerTeam: 'home' | 'away' | 'even' | null = null;

            if (
              homeRatings.length === lineupSize &&
              awayRatings.length === lineupSize
            ) {
              if (fargo5v5.threshold.mode !== 'start_points') {
                throw new Error('fargo5v5 threshold must be start_points mode');
              }
              const computed = fargo5v5.threshold.compute(
                homeRatings,
                awayRatings,
                systemOverrides ?? {}
              );
              weakerTeam = computed.weakerTeam;
              if (startPointsValue === null) {
                startPointsValue = computed.startPointsForWeakerTeam;
              }
            } else {
              // Missing ratings — log and fall back to zeros so the match
              // can still proceed. Negotiation should have blocked us here,
              // but be defensive.
              logger.error('Fargo match prep without complete ratings', {
                matchId,
                homeRatingsCount: homeRatings.length,
                awayRatingsCount: awayRatings.length,
                expected: lineupSize,
              });
              startPointsValue = startPointsValue ?? 0;
            }

            await updateMatchMutation.mutateAsync({
              matchId,
              updates: {
                home_games_to_win:
                  weakerTeam === 'home' ? startPointsValue ?? 0 : 0,
                home_games_to_tie: null,
                home_games_to_lose: null,
                away_games_to_win:
                  weakerTeam === 'away' ? startPointsValue ?? 0 : 0,
                away_games_to_tie: null,
                away_games_to_lose: null,
              },
            });
          } else {
            setPreparationMessage?.('Calculating handicap thresholds...');
            const { homeThresholds, awayThresholds } =
              await calculateHandicapThresholds(
                myLineup as any,
                opponentLineup,
                matchData.home_team_id,
                matchData.away_team_id,
                matchData.season_id,
                handicapType,
              );

            setPreparationMessage?.('Saving match settings...');
            await updateMatchMutation.mutateAsync({
              matchId,
              updates: {
                home_games_to_win: homeThresholds.games_to_win,
                home_games_to_tie: homeThresholds.games_to_tie,
                home_games_to_lose: homeThresholds.games_to_lose,
                away_games_to_win: awayThresholds.games_to_win,
                away_games_to_tie: awayThresholds.games_to_tie,
                away_games_to_lose: awayThresholds.games_to_lose,
              },
            });
          }

          // Create all game rows in match_games table
          setPreparationMessage?.('Creating games...');
          const useDoubleRoundRobin = lineupSize === 3; // TODO: read from game_generation pref

          const allGames = generateGameOrder(
            lineupSize,
            useDoubleRoundRobin
          );

          const homeLineup = isHomeTeam ? myLineup : opponentLineup;
          const awayLineup = isHomeTeam ? opponentLineup : myLineup;

          const gameRows = allGames.map((game) => ({
            match_id: matchId,
            game_number: game.gameNumber,
            game_type: matchData?.league.game_type || 'eight_ball',
            home_player_id: (homeLineup as any)[
              `player${game.homePlayerPosition}_id`
            ],
            away_player_id: (awayLineup as any)[
              `player${game.awayPlayerPosition}_id`
            ],
            home_position: game.homePlayerPosition, // Track position for double duty players
            away_position: game.awayPlayerPosition, // Track position for double duty players
            home_action: game.homeAction,
            away_action: game.awayAction,
          }));

          const { error: gamesError } = await supabase
            .from('match_games')
            .insert(gameRows);

          if (gamesError) {
            if (!gamesError.message.includes('duplicate key')) {
              throw new Error(`Failed to create games: ${gamesError.message}`);
            }
          }

          // STEP 5: Final verification and cache propagation before navigation
          setPreparationMessage?.('Final verification...');
          await new Promise(resolve => setTimeout(resolve, 500));

          setIsPreparingMatch?.(false);
          navigate(`/match/${matchId}/score`);
        } catch (error: any) {
          logger.error('Error preparing match', {
            error: error instanceof Error ? error.message : String(error),
            matchId,
            isHomeTeam
          });
          setIsPreparingMatch?.(false);
          toast.error(`Failed to prepare match: ${error.message}`);
          matchPreparedRef.current = false;
        }
      };

      prepareMatchAndNavigate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    lineupLocked,
    opponentLineup,
    matchId,
    fargoNegotiationBlocking,
  ]);
}
