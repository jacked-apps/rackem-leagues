/**
 * @fileoverview Match Editor State Management Hook
 *
 * useReducer-based state management for the Match Data Page.
 * Handles all editing state for lineups, thresholds, games, and match results.
 *
 * Design Philosophy:
 * - UI-first approach: Build state shape based on what the UI needs
 * - Local state only: No database writes until UI is validated
 * - Everything editable: All auto-calculated values can be overridden
 *
 * State Sections:
 * - formatConfig: How this match should be scored (lineup size, handicap type, etc.)
 * - homeLineup/awayLineup: Players and their handicaps
 * - thresholds: Games needed to win/tie for each team
 * - games: Individual game results
 * - result: Final match outcome and points
 *
 * @example
 * const { state, dispatch, actions } = useMatchEditorState({
 *   initialFormatConfig: { lineupSize: 3, handicapType: 'points' },
 *   existingLineups: { home: homeLineup, away: awayLineup },
 *   existingGames: games,
 *   matchData: match,
 * });
 */

import { useReducer, useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

/** Handicap calculation method */
export type HandicapType = 'points' | 'percentage' | 'custom';

/** Game generation method */
export type GameGeneration = 'double_rr' | 'single_rr' | 'manual';

/** Points calculation system */
export type PointsSystem = 'differential' | 'bca_tiered' | 'per_game' | 'manual';

/** Match result outcome */
export type MatchResult = 'home_win' | 'away_win' | 'tie' | null;

/** Format configuration for how this match should be scored */
export interface FormatConfig {
  /** Number of players per team (3-6) */
  lineupSize: number;
  /** How handicaps are calculated */
  handicapType: HandicapType;
  /** How games are generated */
  gameGeneration: GameGeneration;
  /** How points are calculated */
  pointsSystem: PointsSystem;
}

/** Single player slot in a lineup */
export interface LineupPlayer {
  /** Position in lineup (1-based) */
  position: number;
  /** Player ID (null if slot empty) */
  playerId: string | null;
  /** Player display name */
  playerName: string;
  /** Player's handicap value for this match */
  handicap: number;
}

/** Team lineup with players and total */
export interface TeamLineup {
  /** Team ID */
  teamId: string;
  /** Team display name */
  teamName: string;
  /** Players in the lineup */
  players: LineupPlayer[];
  /** Sum of all player handicaps */
  teamTotal: number;
}

/** Threshold values for determining match outcome */
export interface Thresholds {
  /** Games home team needs to win */
  homeWin: number | null;
  /** Games home team needs to tie */
  homeTie: number | null;
  /** Games away team needs to win */
  awayWin: number | null;
  /** Games away team needs to tie */
  awayTie: number | null;
}

/** Single game record */
export interface Game {
  /** Unique identifier for this game */
  id: string;
  /** Game number (1-based order) */
  gameNumber: number;
  /** Home player ID (null if not assigned) */
  homePlayerId: string | null;
  /** Home player name for display */
  homePlayerName: string;
  /** Away player ID (null if not assigned) */
  awayPlayerId: string | null;
  /** Away player name for display */
  awayPlayerName: string;
  /** ID of winning player (null if not scored) */
  winnerPlayerId: string | null;
  /** ID of winning team (null if not scored) */
  winnerTeamId: string | null;
  /** Was this a break and run? */
  breakAndRun: boolean;
  /** Was this a golden break? */
  goldenBreak: boolean;
  /** Which team breaks */
  breakerTeam: 'home' | 'away';
}

/** Final match result and points */
export interface MatchResultState {
  /** Total games won by home team */
  homeGamesWon: number;
  /** Total games won by away team */
  awayGamesWon: number;
  /** Points earned by home team (null if not calculated) */
  homePoints: number | null;
  /** Points earned by away team (null if not calculated) */
  awayPoints: number | null;
  /** Match outcome */
  winner: MatchResult;
}

/** Complete editor state */
export interface MatchEditorState {
  /** Match ID being edited */
  matchId: string;
  /** Home team ID */
  homeTeamId: string;
  /** Away team ID */
  awayTeamId: string;
  /** Format configuration */
  formatConfig: FormatConfig;
  /** Home team lineup */
  homeLineup: TeamLineup;
  /** Away team lineup */
  awayLineup: TeamLineup;
  /** Win/tie thresholds */
  thresholds: Thresholds;
  /** Individual games */
  games: Game[];
  /** Final match result */
  result: MatchResultState;
  /** Whether state has unsaved changes */
  isDirty: boolean;
  /** Whether state is being saved */
  isSaving: boolean;
}

// =============================================================================
// ACTION TYPES
// =============================================================================

export type MatchEditorAction =
  // Format config actions
  | { type: 'SET_LINEUP_SIZE'; payload: number }
  | { type: 'SET_HANDICAP_TYPE'; payload: HandicapType }
  | { type: 'SET_GAME_GENERATION'; payload: GameGeneration }
  | { type: 'SET_POINTS_SYSTEM'; payload: PointsSystem }

  // Lineup actions
  | { type: 'SET_PLAYER'; payload: { team: 'home' | 'away'; position: number; playerId: string | null; playerName: string } }
  | { type: 'SET_PLAYER_HANDICAP'; payload: { team: 'home' | 'away'; position: number; handicap: number } }
  | { type: 'ADD_PLAYER_SLOT'; payload: { team: 'home' | 'away' } }
  | { type: 'REMOVE_PLAYER_SLOT'; payload: { team: 'home' | 'away'; position: number } }
  | { type: 'SET_FULL_LINEUP'; payload: { team: 'home' | 'away'; players: LineupPlayer[] } }

  // Threshold actions
  | { type: 'SET_THRESHOLDS'; payload: Partial<Thresholds> }
  | { type: 'GENERATE_THRESHOLDS'; payload: Thresholds }

  // Game actions
  | { type: 'ADD_GAMES'; payload: Game[] }
  | { type: 'UPDATE_GAME'; payload: { gameId: string; updates: Partial<Game> } }
  | { type: 'SET_GAME_WINNER'; payload: { gameId: string; winnerPlayerId: string | null; winnerTeamId: string | null } }
  | { type: 'REMOVE_GAME'; payload: { gameId: string } }
  | { type: 'CLEAR_ALL_GAMES' }

  // Result actions
  | { type: 'SET_RESULT'; payload: Partial<MatchResultState> }
  | { type: 'CALCULATE_RESULT' }

  // State management
  | { type: 'MARK_CLEAN' }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'RESET_STATE'; payload: MatchEditorState };

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate team total handicap from players
 */
function calculateTeamTotal(players: LineupPlayer[]): number {
  return players.reduce((sum, player) => sum + (player.handicap || 0), 0);
}

/**
 * Create empty player slots for a lineup
 */
function createEmptyPlayerSlots(count: number): LineupPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    position: i + 1,
    playerId: null,
    playerName: '',
    handicap: 0,
  }));
}

/**
 * Generate a unique ID for new games
 */
function generateGameId(): string {
  return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Count games won by each team
 */
function countWins(games: Game[], homeTeamId: string, awayTeamId: string): { homeWins: number; awayWins: number } {
  let homeWins = 0;
  let awayWins = 0;

  games.forEach(game => {
    if (game.winnerTeamId === homeTeamId) {
      homeWins++;
    } else if (game.winnerTeamId === awayTeamId) {
      awayWins++;
    }
  });

  return { homeWins, awayWins };
}

/**
 * Determine match winner based on game wins and thresholds
 */
function determineWinner(
  homeWins: number,
  awayWins: number,
  thresholds: Thresholds
): MatchResult {
  const { homeWin, homeTie, awayWin, awayTie } = thresholds;

  // Can't determine without thresholds
  if (homeWin === null || awayWin === null) {
    return null;
  }

  // Check for wins
  if (homeWins >= homeWin) {
    return 'home_win';
  }
  if (awayWins >= awayWin) {
    return 'away_win';
  }

  // Check for tie (if tie thresholds exist)
  if (homeTie !== null && awayTie !== null) {
    if (homeWins >= homeTie && awayWins >= awayTie) {
      return 'tie';
    }
  }

  return null;
}

// =============================================================================
// REDUCER
// =============================================================================

function matchEditorReducer(state: MatchEditorState, action: MatchEditorAction): MatchEditorState {
  switch (action.type) {
    // -------------------------------------------------------------------------
    // FORMAT CONFIG ACTIONS
    // -------------------------------------------------------------------------
    case 'SET_LINEUP_SIZE': {
      const newSize = action.payload;
      const currentHomeSize = state.homeLineup.players.length;
      const currentAwaySize = state.awayLineup.players.length;

      // Adjust home lineup
      let newHomePlayers = [...state.homeLineup.players];
      if (newSize > currentHomeSize) {
        // Add empty slots
        for (let i = currentHomeSize; i < newSize; i++) {
          newHomePlayers.push({
            position: i + 1,
            playerId: null,
            playerName: '',
            handicap: 0,
          });
        }
      } else if (newSize < currentHomeSize) {
        // Remove slots from end
        newHomePlayers = newHomePlayers.slice(0, newSize);
      }

      // Adjust away lineup
      let newAwayPlayers = [...state.awayLineup.players];
      if (newSize > currentAwaySize) {
        for (let i = currentAwaySize; i < newSize; i++) {
          newAwayPlayers.push({
            position: i + 1,
            playerId: null,
            playerName: '',
            handicap: 0,
          });
        }
      } else if (newSize < currentAwaySize) {
        newAwayPlayers = newAwayPlayers.slice(0, newSize);
      }

      return {
        ...state,
        formatConfig: { ...state.formatConfig, lineupSize: newSize },
        homeLineup: {
          ...state.homeLineup,
          players: newHomePlayers,
          teamTotal: calculateTeamTotal(newHomePlayers),
        },
        awayLineup: {
          ...state.awayLineup,
          players: newAwayPlayers,
          teamTotal: calculateTeamTotal(newAwayPlayers),
        },
        isDirty: true,
      };
    }

    case 'SET_HANDICAP_TYPE':
      return {
        ...state,
        formatConfig: { ...state.formatConfig, handicapType: action.payload },
        isDirty: true,
      };

    case 'SET_GAME_GENERATION':
      return {
        ...state,
        formatConfig: { ...state.formatConfig, gameGeneration: action.payload },
        isDirty: true,
      };

    case 'SET_POINTS_SYSTEM':
      return {
        ...state,
        formatConfig: { ...state.formatConfig, pointsSystem: action.payload },
        isDirty: true,
      };

    // -------------------------------------------------------------------------
    // LINEUP ACTIONS
    // -------------------------------------------------------------------------
    case 'SET_PLAYER': {
      const { team, position, playerId, playerName } = action.payload;
      const lineupKey = team === 'home' ? 'homeLineup' : 'awayLineup';
      const lineup = state[lineupKey];

      const newPlayers = lineup.players.map(player =>
        player.position === position
          ? { ...player, playerId, playerName }
          : player
      );

      return {
        ...state,
        [lineupKey]: {
          ...lineup,
          players: newPlayers,
        },
        isDirty: true,
      };
    }

    case 'SET_PLAYER_HANDICAP': {
      const { team, position, handicap } = action.payload;
      const lineupKey = team === 'home' ? 'homeLineup' : 'awayLineup';
      const lineup = state[lineupKey];

      const newPlayers = lineup.players.map(player =>
        player.position === position
          ? { ...player, handicap }
          : player
      );

      return {
        ...state,
        [lineupKey]: {
          ...lineup,
          players: newPlayers,
          teamTotal: calculateTeamTotal(newPlayers),
        },
        isDirty: true,
      };
    }

    case 'ADD_PLAYER_SLOT': {
      const { team } = action.payload;
      const lineupKey = team === 'home' ? 'homeLineup' : 'awayLineup';
      const lineup = state[lineupKey];

      // Don't allow more than 6 players
      if (lineup.players.length >= 6) {
        return state;
      }

      const newPosition = lineup.players.length + 1;
      const newPlayers = [
        ...lineup.players,
        {
          position: newPosition,
          playerId: null,
          playerName: '',
          handicap: 0,
        },
      ];

      return {
        ...state,
        [lineupKey]: {
          ...lineup,
          players: newPlayers,
        },
        isDirty: true,
      };
    }

    case 'REMOVE_PLAYER_SLOT': {
      const { team, position } = action.payload;
      const lineupKey = team === 'home' ? 'homeLineup' : 'awayLineup';
      const lineup = state[lineupKey];

      // Don't allow fewer than 3 players
      if (lineup.players.length <= 3) {
        return state;
      }

      // Remove player at position and renumber remaining
      const newPlayers = lineup.players
        .filter(player => player.position !== position)
        .map((player, index) => ({
          ...player,
          position: index + 1,
        }));

      return {
        ...state,
        [lineupKey]: {
          ...lineup,
          players: newPlayers,
          teamTotal: calculateTeamTotal(newPlayers),
        },
        isDirty: true,
      };
    }

    case 'SET_FULL_LINEUP': {
      const { team, players } = action.payload;
      const lineupKey = team === 'home' ? 'homeLineup' : 'awayLineup';

      return {
        ...state,
        [lineupKey]: {
          ...state[lineupKey],
          players,
          teamTotal: calculateTeamTotal(players),
        },
        isDirty: true,
      };
    }

    // -------------------------------------------------------------------------
    // THRESHOLD ACTIONS
    // -------------------------------------------------------------------------
    case 'SET_THRESHOLDS':
      return {
        ...state,
        thresholds: { ...state.thresholds, ...action.payload },
        isDirty: true,
      };

    case 'GENERATE_THRESHOLDS':
      return {
        ...state,
        thresholds: action.payload,
        isDirty: true,
      };

    // -------------------------------------------------------------------------
    // GAME ACTIONS
    // -------------------------------------------------------------------------
    case 'ADD_GAMES': {
      const newGames = action.payload.map((game, index) => ({
        ...game,
        // Ensure unique game numbers
        gameNumber: game.gameNumber || state.games.length + index + 1,
        id: game.id || generateGameId(),
      }));

      return {
        ...state,
        games: [...state.games, ...newGames],
        isDirty: true,
      };
    }

    case 'UPDATE_GAME': {
      const { gameId, updates } = action.payload;
      const newGames = state.games.map(game =>
        game.id === gameId ? { ...game, ...updates } : game
      );

      return {
        ...state,
        games: newGames,
        isDirty: true,
      };
    }

    case 'SET_GAME_WINNER': {
      const { gameId, winnerPlayerId, winnerTeamId } = action.payload;
      const newGames = state.games.map(game =>
        game.id === gameId
          ? { ...game, winnerPlayerId, winnerTeamId }
          : game
      );

      // Recalculate wins
      const { homeWins, awayWins } = countWins(newGames, state.homeTeamId, state.awayTeamId);

      return {
        ...state,
        games: newGames,
        result: {
          ...state.result,
          homeGamesWon: homeWins,
          awayGamesWon: awayWins,
        },
        isDirty: true,
      };
    }

    case 'REMOVE_GAME': {
      const { gameId } = action.payload;
      const newGames = state.games
        .filter(game => game.id !== gameId)
        .map((game, index) => ({
          ...game,
          gameNumber: index + 1, // Renumber
        }));

      // Recalculate wins
      const { homeWins, awayWins } = countWins(newGames, state.homeTeamId, state.awayTeamId);

      return {
        ...state,
        games: newGames,
        result: {
          ...state.result,
          homeGamesWon: homeWins,
          awayGamesWon: awayWins,
        },
        isDirty: true,
      };
    }

    case 'CLEAR_ALL_GAMES':
      return {
        ...state,
        games: [],
        result: {
          ...state.result,
          homeGamesWon: 0,
          awayGamesWon: 0,
        },
        isDirty: true,
      };

    // -------------------------------------------------------------------------
    // RESULT ACTIONS
    // -------------------------------------------------------------------------
    case 'SET_RESULT':
      return {
        ...state,
        result: { ...state.result, ...action.payload },
        isDirty: true,
      };

    case 'CALCULATE_RESULT': {
      const { homeWins, awayWins } = countWins(state.games, state.homeTeamId, state.awayTeamId);
      const winner = determineWinner(homeWins, awayWins, state.thresholds);

      return {
        ...state,
        result: {
          ...state.result,
          homeGamesWon: homeWins,
          awayGamesWon: awayWins,
          winner,
        },
        isDirty: true,
      };
    }

    // -------------------------------------------------------------------------
    // STATE MANAGEMENT
    // -------------------------------------------------------------------------
    case 'MARK_CLEAN':
      return {
        ...state,
        isDirty: false,
      };

    case 'SET_SAVING':
      return {
        ...state,
        isSaving: action.payload,
      };

    case 'RESET_STATE':
      return action.payload;

    default:
      return state;
  }
}

// =============================================================================
// INITIAL STATE FACTORY
// =============================================================================

export interface InitialStateConfig {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  /** Default lineup size (usually from league settings) */
  defaultLineupSize?: number;
  /** Default handicap type (from league settings) */
  defaultHandicapType?: HandicapType;
  /** Existing match thresholds */
  existingThresholds?: Partial<Thresholds>;
}

/**
 * Create initial state for the match editor
 */
export function createInitialState(config: InitialStateConfig): MatchEditorState {
  const {
    matchId,
    homeTeamId,
    awayTeamId,
    homeTeamName,
    awayTeamName,
    defaultLineupSize = 3,
    defaultHandicapType = 'points',
    existingThresholds,
  } = config;

  return {
    matchId,
    homeTeamId,
    awayTeamId,
    formatConfig: {
      lineupSize: defaultLineupSize,
      handicapType: defaultHandicapType,
      gameGeneration: 'double_rr',
      pointsSystem: 'differential',
    },
    homeLineup: {
      teamId: homeTeamId,
      teamName: homeTeamName,
      players: createEmptyPlayerSlots(defaultLineupSize),
      teamTotal: 0,
    },
    awayLineup: {
      teamId: awayTeamId,
      teamName: awayTeamName,
      players: createEmptyPlayerSlots(defaultLineupSize),
      teamTotal: 0,
    },
    thresholds: {
      homeWin: existingThresholds?.homeWin ?? null,
      homeTie: existingThresholds?.homeTie ?? null,
      awayWin: existingThresholds?.awayWin ?? null,
      awayTie: existingThresholds?.awayTie ?? null,
    },
    games: [],
    result: {
      homeGamesWon: 0,
      awayGamesWon: 0,
      homePoints: null,
      awayPoints: null,
      winner: null,
    },
    isDirty: false,
    isSaving: false,
  };
}

// =============================================================================
// HOOK
// =============================================================================

export interface UseMatchEditorStateReturn {
  /** Current state */
  state: MatchEditorState;
  /** Dispatch function for actions */
  dispatch: React.Dispatch<MatchEditorAction>;
  /** Convenience action creators */
  actions: {
    // Format config
    setLineupSize: (size: number) => void;
    setHandicapType: (type: HandicapType) => void;
    setGameGeneration: (method: GameGeneration) => void;
    setPointsSystem: (system: PointsSystem) => void;
    // Lineups
    setPlayer: (team: 'home' | 'away', position: number, playerId: string | null, playerName: string) => void;
    setPlayerHandicap: (team: 'home' | 'away', position: number, handicap: number) => void;
    addPlayerSlot: (team: 'home' | 'away') => void;
    removePlayerSlot: (team: 'home' | 'away', position: number) => void;
    // Thresholds
    setThresholds: (thresholds: Partial<Thresholds>) => void;
    generateThresholds: (thresholds: Thresholds) => void;
    // Games
    addGames: (games: Game[]) => void;
    updateGame: (gameId: string, updates: Partial<Game>) => void;
    setGameWinner: (gameId: string, winnerPlayerId: string | null, winnerTeamId: string | null) => void;
    removeGame: (gameId: string) => void;
    clearAllGames: () => void;
    // Results
    setResult: (result: Partial<MatchResultState>) => void;
    calculateResult: () => void;
    // State
    markClean: () => void;
    setSaving: (saving: boolean) => void;
    resetState: (state: MatchEditorState) => void;
  };
  /** Computed values */
  computed: {
    /** Can auto-generate thresholds for current format */
    canAutoGenerateThresholds: boolean;
    /** Number of games expected for current lineup size and game generation */
    expectedGameCount: number;
    /** Whether all lineups are complete (all slots filled) */
    lineupsComplete: boolean;
    /** Whether match can be marked complete */
    canComplete: boolean;
  };
}

/**
 * Main hook for match editor state management
 *
 * @param initialConfig - Configuration for initial state
 * @returns State, dispatch, actions, and computed values
 */
export function useMatchEditorState(initialConfig: InitialStateConfig): UseMatchEditorStateReturn {
  const [state, dispatch] = useReducer(
    matchEditorReducer,
    initialConfig,
    createInitialState
  );

  // Memoized action creators
  const actions = useMemo(() => ({
    // Format config
    setLineupSize: (size: number) => dispatch({ type: 'SET_LINEUP_SIZE', payload: size }),
    setHandicapType: (type: HandicapType) => dispatch({ type: 'SET_HANDICAP_TYPE', payload: type }),
    setGameGeneration: (method: GameGeneration) => dispatch({ type: 'SET_GAME_GENERATION', payload: method }),
    setPointsSystem: (system: PointsSystem) => dispatch({ type: 'SET_POINTS_SYSTEM', payload: system }),

    // Lineups
    setPlayer: (team: 'home' | 'away', position: number, playerId: string | null, playerName: string) =>
      dispatch({ type: 'SET_PLAYER', payload: { team, position, playerId, playerName } }),
    setPlayerHandicap: (team: 'home' | 'away', position: number, handicap: number) =>
      dispatch({ type: 'SET_PLAYER_HANDICAP', payload: { team, position, handicap } }),
    addPlayerSlot: (team: 'home' | 'away') =>
      dispatch({ type: 'ADD_PLAYER_SLOT', payload: { team } }),
    removePlayerSlot: (team: 'home' | 'away', position: number) =>
      dispatch({ type: 'REMOVE_PLAYER_SLOT', payload: { team, position } }),

    // Thresholds
    setThresholds: (thresholds: Partial<Thresholds>) =>
      dispatch({ type: 'SET_THRESHOLDS', payload: thresholds }),
    generateThresholds: (thresholds: Thresholds) =>
      dispatch({ type: 'GENERATE_THRESHOLDS', payload: thresholds }),

    // Games
    addGames: (games: Game[]) =>
      dispatch({ type: 'ADD_GAMES', payload: games }),
    updateGame: (gameId: string, updates: Partial<Game>) =>
      dispatch({ type: 'UPDATE_GAME', payload: { gameId, updates } }),
    setGameWinner: (gameId: string, winnerPlayerId: string | null, winnerTeamId: string | null) =>
      dispatch({ type: 'SET_GAME_WINNER', payload: { gameId, winnerPlayerId, winnerTeamId } }),
    removeGame: (gameId: string) =>
      dispatch({ type: 'REMOVE_GAME', payload: { gameId } }),
    clearAllGames: () =>
      dispatch({ type: 'CLEAR_ALL_GAMES' }),

    // Results
    setResult: (result: Partial<MatchResultState>) =>
      dispatch({ type: 'SET_RESULT', payload: result }),
    calculateResult: () =>
      dispatch({ type: 'CALCULATE_RESULT' }),

    // State
    markClean: () => dispatch({ type: 'MARK_CLEAN' }),
    setSaving: (saving: boolean) => dispatch({ type: 'SET_SAVING', payload: saving }),
    resetState: (newState: MatchEditorState) => dispatch({ type: 'RESET_STATE', payload: newState }),
  }), [dispatch]);

  // Computed values
  const computed = useMemo(() => {
    const { formatConfig, homeLineup, awayLineup, games, thresholds } = state;

    // Can auto-generate thresholds only for known formats
    const canAutoGenerateThresholds =
      (formatConfig.lineupSize === 3 && formatConfig.handicapType === 'points') ||
      (formatConfig.lineupSize === 5 && formatConfig.handicapType === 'percentage');

    // Expected game count based on lineup size and generation method
    let expectedGameCount = 0;
    const playerCount = formatConfig.lineupSize;
    if (formatConfig.gameGeneration === 'double_rr') {
      expectedGameCount = playerCount * playerCount * 2; // Each pair plays twice
    } else if (formatConfig.gameGeneration === 'single_rr') {
      expectedGameCount = playerCount * playerCount; // Each pair plays once
    }
    // Manual has no expected count

    // Check if all lineup slots are filled
    const homeComplete = homeLineup.players.every(p => p.playerId !== null);
    const awayComplete = awayLineup.players.every(p => p.playerId !== null);
    const lineupsComplete = homeComplete && awayComplete;

    // Can complete if we have winners for all games
    const allGamesScored = games.length > 0 && games.every(g => g.winnerTeamId !== null);
    const hasThresholds = thresholds.homeWin !== null && thresholds.awayWin !== null;
    const canComplete = lineupsComplete && allGamesScored && hasThresholds;

    return {
      canAutoGenerateThresholds,
      expectedGameCount,
      lineupsComplete,
      canComplete,
    };
  }, [state]);

  return {
    state,
    dispatch,
    actions,
    computed,
  };
}

export default useMatchEditorState;
