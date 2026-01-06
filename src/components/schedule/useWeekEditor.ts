/**
 * @fileoverview Week Editor Hook
 *
 * Custom hook for managing schedule edit state within a week.
 * Handles team swapping logic, venue changes, validation, and state management.
 *
 * Key responsibilities:
 * - Track edited match state (home/away teams, venue)
 * - Implement swap logic (when selecting a team, auto-swap with where it was)
 * - Track original state for revert functionality
 * - Compute hasChanges and validation status
 *
 * Design decisions:
 * - Uses useState with array (not useReducer - overkill for this use case)
 * - Uses useRef for original state (no re-renders on comparison)
 * - Swap logic ensures each team appears exactly once per week
 */

import { useState, useRef, useMemo, useCallback } from 'react';

/**
 * Simple deep equality check for match comparison objects
 * Uses JSON stringify - works for simple objects with primitives
 */
function isEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Represents the editable state of a single match
 */
export interface MatchEditState {
  /** Match ID from database */
  matchId: string;
  /** Home team ID (null for BYE) */
  homeTeamId: string | null;
  /** Away team ID (null for BYE) */
  awayTeamId: string | null;
  /** Venue ID for the match */
  venueId: string | null;
  /** Original home team name (for display) */
  homeTeamName: string;
  /** Original away team name (for display) */
  awayTeamName: string;
  /** Whether this match can be edited (false if already started/completed) */
  isEditable: boolean;
  /** Match number within the week */
  matchNumber: number;
}

/**
 * Props for initializing the week editor
 */
export interface UseWeekEditorProps {
  /** Initial match states from the database */
  initialMatches: MatchEditState[];
}

/**
 * Return type for the useWeekEditor hook
 */
export interface UseWeekEditorReturn {
  /** Current edited match states */
  editedMatches: MatchEditState[];
  /** Handle team selection with auto-swap logic */
  handleTeamChange: (matchId: string, position: 'home' | 'away', newTeamId: string | null) => void;
  /** Handle venue change for a match */
  handleVenueChange: (matchId: string, venueId: string | null) => void;
  /** Reset all matches to original state */
  handleRevert: () => void;
  /** Whether any changes have been made */
  hasChanges: boolean;
  /** Get matches that have changed (for saving) */
  getChangedMatches: () => MatchEditState[];
}

/**
 * Hook for managing week schedule editing state
 *
 * Provides state management and swap logic for editing matches within a week.
 * Ensures each team appears exactly once by automatically swapping teams
 * when a selection would cause a duplicate.
 *
 * @param props - Initial match states
 * @returns Editor state and handlers
 *
 * @example
 * const {
 *   editedMatches,
 *   handleTeamChange,
 *   handleVenueChange,
 *   handleRevert,
 *   hasChanges,
 *   getChangedMatches,
 * } = useWeekEditor({ initialMatches });
 *
 * // When user selects Team D for Match 1 home position:
 * // If Team D was in Match 2 away, they swap automatically
 * handleTeamChange('match-1', 'home', 'team-d-id');
 */
export function useWeekEditor({ initialMatches }: UseWeekEditorProps): UseWeekEditorReturn {
  // Current edited state
  const [editedMatches, setEditedMatches] = useState<MatchEditState[]>(initialMatches);

  // Original state for comparison and revert (useRef to avoid re-renders)
  const originalMatches = useRef<MatchEditState[]>(initialMatches);

  /**
   * Handle team selection with automatic swap logic
   *
   * When a team is selected for a position:
   * 1. Find where that team currently is (if anywhere in editable matches)
   * 2. Swap: put the old team where the new team was
   * 3. Put the new team in the target position
   *
   * This ensures each team appears exactly once.
   */
  const handleTeamChange = useCallback((
    matchId: string,
    position: 'home' | 'away',
    newTeamId: string | null
  ) => {
    setEditedMatches(prev => {
      const updated = prev.map(m => ({ ...m })); // Deep copy

      // Find the target match
      const targetMatchIndex = updated.findIndex(m => m.matchId === matchId);
      if (targetMatchIndex === -1) return prev;

      const targetMatch = updated[targetMatchIndex];

      // Skip if match is not editable
      if (!targetMatch.isEditable) return prev;

      // Get the old team ID that's being replaced
      const oldTeamId = position === 'home' ? targetMatch.homeTeamId : targetMatch.awayTeamId;

      // If selecting the same team, no change needed
      if (oldTeamId === newTeamId) return prev;

      // Find where the new team currently is (only in editable matches)
      const sourceMatchIndex = updated.findIndex(m =>
        m.isEditable && m.matchId !== matchId &&
        (m.homeTeamId === newTeamId || m.awayTeamId === newTeamId)
      );

      // If the new team exists in another match, swap
      if (sourceMatchIndex !== -1 && newTeamId !== null) {
        const sourceMatch = updated[sourceMatchIndex];

        // Put the old team where the new team was
        if (sourceMatch.homeTeamId === newTeamId) {
          sourceMatch.homeTeamId = oldTeamId;
        } else if (sourceMatch.awayTeamId === newTeamId) {
          sourceMatch.awayTeamId = oldTeamId;
        }
      }

      // Put the new team in the target position
      if (position === 'home') {
        targetMatch.homeTeamId = newTeamId;
      } else {
        targetMatch.awayTeamId = newTeamId;
      }

      return updated;
    });
  }, []);

  /**
   * Handle venue change for a match
   */
  const handleVenueChange = useCallback((matchId: string, venueId: string | null) => {
    setEditedMatches(prev =>
      prev.map(m =>
        m.matchId === matchId && m.isEditable
          ? { ...m, venueId }
          : m
      )
    );
  }, []);

  /**
   * Reset all matches to original state
   */
  const handleRevert = useCallback(() => {
    setEditedMatches(originalMatches.current.map(m => ({ ...m })));
  }, []);

  /**
   * Check if any changes have been made
   */
  const hasChanges = useMemo(() => {
    return !isEqual(
      editedMatches.map(m => ({
        matchId: m.matchId,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        venueId: m.venueId,
      })),
      originalMatches.current.map(m => ({
        matchId: m.matchId,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        venueId: m.venueId,
      }))
    );
  }, [editedMatches]);

  /**
   * Get only the matches that have changed (for saving)
   */
  const getChangedMatches = useCallback((): MatchEditState[] => {
    return editedMatches.filter((edited, index) => {
      const original = originalMatches.current[index];
      return (
        edited.homeTeamId !== original.homeTeamId ||
        edited.awayTeamId !== original.awayTeamId ||
        edited.venueId !== original.venueId
      );
    });
  }, [editedMatches]);

  return {
    editedMatches,
    handleTeamChange,
    handleVenueChange,
    handleRevert,
    hasChanges,
    getChangedMatches,
  };
}
