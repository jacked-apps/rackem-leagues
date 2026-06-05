/**
 * @fileoverview Unit tests for the LO manual-scoring eligibility predicate.
 */

import { describe, it, expect } from 'vitest';
import {
  isMatchEligibleForManualScoring,
  isMatchEligibleForReview,
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

  it('is true for an updating match (a manual entry to resume)', () => {
    expect(isMatchEligibleForManualScoring(match({ status: 'updating' as never }))).toBe(true);
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

describe('isMatchEligibleForReview', () => {
  it.each(['completed', 'awaiting_verification'])(
    'is true for a %s match with two real teams',
    (status) => {
      expect(isMatchEligibleForReview(match({ status: status as never }))).toBe(true);
    }
  );

  it.each(['scheduled', 'forfeited', 'postponed'])(
    'is false for a %s match',
    (status) => {
      expect(isMatchEligibleForReview(match({ status: status as never }))).toBe(false);
    }
  );

  it('is false for an in_progress match with no completed_at (actively scoring)', () => {
    expect(isMatchEligibleForReview(match({ status: 'in_progress' as never }))).toBe(false);
  });

  it('is true for a reopened-not-refinalized match (in_progress + completed_at set)', () => {
    expect(
      isMatchEligibleForReview(
        match({ status: 'in_progress' as never, completed_at: '2026-06-01T00:00:00Z' } as never)
      )
    ).toBe(true);
  });

  it('is false when a side is a BYE even if completed', () => {
    expect(
      isMatchEligibleForReview(match({ status: 'completed' as never, away_team: null }))
    ).toBe(false);
  });
});

describe('manualScoringStatusLabel', () => {
  it('maps known statuses to readable labels', () => {
    expect(manualScoringStatusLabel('scheduled')).toBe('Scheduled');
    expect(manualScoringStatusLabel('updating')).toBe('Updating');
    expect(manualScoringStatusLabel('in_progress')).toBe('In Progress');
    expect(manualScoringStatusLabel('completed')).toBe('Completed');
  });

  it('falls back to the raw value for unknown statuses', () => {
    expect(manualScoringStatusLabel('weird')).toBe('weird');
  });
});
