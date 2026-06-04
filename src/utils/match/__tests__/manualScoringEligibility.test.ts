/**
 * @fileoverview Unit tests for the LO manual-scoring eligibility predicate.
 */

import { describe, it, expect } from 'vitest';
import {
  isMatchEligibleForManualScoring,
  manualScoringStatusLabel,
} from '../manualScoringEligibility';
import type { MatchWithDetails } from '@/types/schedule';

const team = (name: string) => ({
  id: name,
  team_name: name,
  captain_id: null,
  status: 'active' as const,
});

function match(over: Partial<MatchWithDetails>): MatchWithDetails {
  return {
    status: 'scheduled',
    home_team: team('home'),
    away_team: team('away'),
    ...over,
  } as MatchWithDetails;
}

describe('isMatchEligibleForManualScoring', () => {
  it('is true for a scheduled match with two real teams', () => {
    expect(isMatchEligibleForManualScoring(match({}))).toBe(true);
  });

  it.each(['in_progress', 'awaiting_verification', 'completed', 'forfeited', 'postponed'])(
    'is false for a %s match',
    (status) => {
      expect(isMatchEligibleForManualScoring(match({ status: status as never }))).toBe(false);
    }
  );

  it('is false when a side is a BYE (null team)', () => {
    expect(isMatchEligibleForManualScoring(match({ away_team: null }))).toBe(false);
  });

  it('is false when a side has bye status', () => {
    expect(
      isMatchEligibleForManualScoring(
        match({ home_team: { ...team('home'), status: 'bye' } })
      )
    ).toBe(false);
  });
});

describe('manualScoringStatusLabel', () => {
  it('maps known statuses to readable labels', () => {
    expect(manualScoringStatusLabel('scheduled')).toBe('Scheduled');
    expect(manualScoringStatusLabel('in_progress')).toBe('In Progress');
    expect(manualScoringStatusLabel('completed')).toBe('Completed');
  });

  it('falls back to the raw value for unknown statuses', () => {
    expect(manualScoringStatusLabel('weird')).toBe('weird');
  });
});
