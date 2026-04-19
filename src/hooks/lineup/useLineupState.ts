/**
 * @fileoverview Lineup State Management Hook
 *
 * Manages the state for player selection in match lineups.
 * Supports both 3-player (3v3) and 5-player (5v5) lineups.
 * Handles player IDs, lineup lock status, substitute handicaps, and test mode.
 *
 * @example
 * // 3v3 lineup
 * const lineup = useLineupState(3);
 * lineup.setPlayerId(1, 'player-uuid');
 *
 * // 5v5 lineup
 * const lineup = useLineupState(5);
 * lineup.setPlayerId(4, 'player-uuid');
 */

import { useState } from 'react';

export interface LineupState {
  // Player count
  playerCount: number;

  // Player selections (always 5 positions, unused ones are empty strings)
  player1Id: string;
  player2Id: string;
  player3Id: string;
  player4Id: string;
  player5Id: string;

  // Lineup status
  lineupLocked: boolean;
  lineupId: string | null;

  // Substitute handicap
  subHandicap: string;

  // Test mode
  testMode: boolean;
  testHandicaps: Record<string, number>;

  // Generic setters
  setPlayerId: (position: 1 | 2 | 3 | 4 | 5, id: string) => void;
  getPlayerId: (position: 1 | 2 | 3 | 4 | 5) => string;

  // Individual setters (for backward compatibility)
  setPlayer1Id: (id: string) => void;
  setPlayer2Id: (id: string) => void;
  setPlayer3Id: (id: string) => void;
  setPlayer4Id: (id: string) => void;
  setPlayer5Id: (id: string) => void;

  setLineupLocked: (locked: boolean) => void;
  setLineupId: (id: string | null) => void;
  setSubHandicap: (handicap: string) => void;
  setTestMode: (enabled: boolean) => void;
  setTestHandicaps: React.Dispatch<React.SetStateAction<Record<string, number>>>;

  // Convenience methods
  lockLineup: () => void;
  unlockLineup: () => void;
  resetTestMode: () => void;
}

/**
 * Hook to manage lineup selection state
 *
 * Provides a centralized state container for all lineup-related state,
 * including player selections, lock status, and test mode overrides.
 *
 * @param playerCount - Number of players in lineup (3 for 3v3, 5 for 5v5)
 * @returns LineupState object with all state and setters
 */
export function useLineupState(playerCount: number = 3): LineupState {
  // Player selections (UUID or "SUBSTITUTE" special ID)
  const [player1Id, setPlayer1Id] = useState<string>('');
  const [player2Id, setPlayer2Id] = useState<string>('');
  const [player3Id, setPlayer3Id] = useState<string>('');
  const [player4Id, setPlayer4Id] = useState<string>('');
  const [player5Id, setPlayer5Id] = useState<string>('');

  // Lineup status
  const [lineupLocked, setLineupLocked] = useState(false);
  const [lineupId, setLineupId] = useState<string | null>(null);

  // Substitute handicap (only used if one player is "SUBSTITUTE")
  const [subHandicap, setSubHandicap] = useState<string>('');

  // Test mode for manual handicap override
  const [testMode, setTestMode] = useState(false);
  const [testHandicaps, setTestHandicaps] = useState<Record<string, number>>({});

  // Generic setter for any position
  const setPlayerId = (position: 1 | 2 | 3 | 4 | 5, id: string) => {
    switch (position) {
      case 1: setPlayer1Id(id); break;
      case 2: setPlayer2Id(id); break;
      case 3: setPlayer3Id(id); break;
      case 4: setPlayer4Id(id); break;
      case 5: setPlayer5Id(id); break;
    }
  };

  // Generic getter for any position
  const getPlayerId = (position: 1 | 2 | 3 | 4 | 5): string => {
    switch (position) {
      case 1: return player1Id;
      case 2: return player2Id;
      case 3: return player3Id;
      case 4: return player4Id;
      case 5: return player5Id;
    }
  };

  // Convenience methods
  const lockLineup = () => setLineupLocked(true);
  const unlockLineup = () => setLineupLocked(false);
  const resetTestMode = () => {
    setTestMode(false);
    setTestHandicaps({});
  };

  return {
    // Player count
    playerCount,

    // State
    player1Id,
    player2Id,
    player3Id,
    player4Id,
    player5Id,
    lineupLocked,
    lineupId,
    subHandicap,
    testMode,
    testHandicaps,

    // Generic accessors
    setPlayerId,
    getPlayerId,

    // Individual setters (backward compatibility)
    setPlayer1Id,
    setPlayer2Id,
    setPlayer3Id,
    setPlayer4Id,
    setPlayer5Id,
    setLineupLocked,
    setLineupId,
    setSubHandicap,
    setTestMode,
    setTestHandicaps,

    // Convenience
    lockLineup,
    unlockLineup,
    resetTestMode,
  };
}
