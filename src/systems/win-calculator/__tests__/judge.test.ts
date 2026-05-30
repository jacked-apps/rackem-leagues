/**
 * @fileoverview Unit tests for the Win Calculator judge (`decideWinner`).
 *
 * Covers the override-first / walk-in-order / no-winner-→-tie flow, that order
 * is load-bearing, that anomalies are collected without blocking the verdict,
 * and the never-break contract (a throwing input is caught, not propagated).
 */
import { describe, it, expect } from 'vitest';
import { decideWinner } from '../judge';
import type { WinCalcConfig, WinCalcState } from '../types';

function state(overrides: Partial<WinCalcState> = {}): WinCalcState {
  return {
    home_games: 0,
    away_games: 0,
    home_points: 0,
    away_points: 0,
    home_games_target: null,
    away_games_target: null,
    home_points_target: null,
    away_points_target: null,
    edge: null,
    ...overrides,
  };
}

const gamesMost: WinCalcConfig = { order: ['games'], games: { mode: 'most' } };
const gamesMetGoal: WinCalcConfig = { order: ['games'], games: { mode: 'met_goal' } };
const pointsThenGames: WinCalcConfig = {
  order: ['points', 'games'],
  points: { mode: 'most' },
  games: { mode: 'most' },
};

describe('decideWinner', () => {
  it('honors the winner chip as an override, before any comparator', () => {
    // chip says away; the comparator would say home — the chip wins
    const r = decideWinner(state({ edge: 'away', home_games: 12, away_games: 6 }), gamesMost);
    expect(r.verdict).toEqual({ winner: 'away' });
  });

  it('decides via met_goal when a side reaches its target', () => {
    const r = decideWinner(
      state({ home_games: 10, home_games_target: 10, away_games: 7, away_games_target: 12 }),
      gamesMetGoal,
    );
    expect(r.verdict).toEqual({ winner: 'home' });
  });

  it('the first comparator that can decide wins (points before games)', () => {
    const r = decideWinner(
      state({ home_points: 50, away_points: 40, home_games: 6, away_games: 9 }),
      pointsThenGames,
    );
    expect(r.verdict).toEqual({ winner: 'home' }); // points (50>40) decides; games never consulted
  });

  it('falls through to the next comparator when the first cannot decide', () => {
    const r = decideWinner(
      state({ home_points: 45, away_points: 45, home_games: 8, away_games: 11 }),
      pointsThenGames,
    );
    expect(r.verdict).toEqual({ winner: 'away' }); // points tied → games (8<11) → away
  });

  it('returns a tie when no comparator can name a winner', () => {
    const r = decideWinner(state({ home_games: 9, away_games: 9 }), gamesMost);
    expect(r.verdict).toEqual({ tie: true });
  });

  it('returns a tie for an empty order (degenerate config)', () => {
    const r = decideWinner(state({ home_games: 12, away_games: 6 }), { order: [] });
    expect(r.verdict).toEqual({ tie: true });
  });

  it('order is load-bearing — same state, flipped order flips the winner', () => {
    // home wins points; away wins games
    const s = state({ home_points: 60, away_points: 40, home_games: 6, away_games: 9 });
    const pg: WinCalcConfig = { order: ['points', 'games'], points: { mode: 'most' }, games: { mode: 'most' } };
    const gp: WinCalcConfig = { order: ['games', 'points'], points: { mode: 'most' }, games: { mode: 'most' } };
    expect(decideWinner(s, pg).verdict).toEqual({ winner: 'home' });
    expect(decideWinner(s, gp).verdict).toEqual({ winner: 'away' });
  });

  it('collects the both-met anomaly as a flag without blocking the verdict', () => {
    const r = decideWinner(
      state({ home_games: 10, home_games_target: 10, away_games: 8, away_games_target: 8 }),
      gamesMetGoal,
    );
    expect(r.verdict).toEqual({ tie: true });
    expect(r.flags.length).toBeGreaterThan(0);
    expect(r.flags[0]).toContain('both');
  });

  it('skips a metric listed in order but missing its mode config', () => {
    const r = decideWinner(state({ home_games: 12, away_games: 6 }), { order: ['games'] });
    expect(r.verdict).toEqual({ tie: true });
    expect(r.flags.some((f) => f.includes('no mode'))).toBe(true);
  });

  it('never throws — a throwing state access is caught, flagged, and yields a tie', () => {
    const hostile = state({ away_games: 6 });
    Object.defineProperty(hostile, 'home_games', {
      get() {
        throw new Error('boom');
      },
    });
    const r = decideWinner(hostile, gamesMost);
    expect(r.verdict).toEqual({ tie: true });
    expect(r.flags.some((f) => f.includes('threw'))).toBe(true);
  });
});
