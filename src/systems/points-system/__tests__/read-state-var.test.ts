/**
 * @fileoverview Tests for the `read_state_var` allocator-formula operation
 * (Unit 3 / R11).
 *
 * The recipe surfaces the communication contract — anywhere the allocator
 * takes a number, the number can come from the state bag by name. The
 * allocator does not know what wrote the bag entry; it just reads.
 *
 * These tests pin the recipe's compute behavior. End-to-end coverage that
 * actually drives a match through `evaluatePointsSystem` with a threshold
 * writing the state-var lives in Unit 8 (the smoke test).
 */

import { describe, it, expect, vi } from 'vitest';
import { readStateVarOperation } from '../allocator-formula-operations/read-state-var';
import type { FormulaContext, MatchStateBag } from '../types';

const CTX: FormulaContext = {
  winner: 0,
  loser: 0,
  thisSide: 'winner',
  winnerSide: 'home',
};

describe('readStateVarOperation', () => {
  it('returns the numeric value of the named state-bag entry', () => {
    const state: MatchStateBag = { pointsPerGame: 5 };
    const result = readStateVarOperation.compute(
      { var_name: 'pointsPerGame' },
      CTX,
      state,
    );
    expect(result).toBe(5);
  });

  it('reads a different variable on a different config', () => {
    const state: MatchStateBag = { home_wins: 12 };
    const result = readStateVarOperation.compute(
      { var_name: 'home_wins' },
      CTX,
      state,
    );
    expect(result).toBe(12);
  });

  it('returns 0 + warn when the named variable is missing from the bag', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = readStateVarOperation.compute(
      { var_name: 'nobody_writes_me' },
      CTX,
      {},
    );
    expect(result).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"nobody_writes_me" is missing or non-numeric'),
    );
    warnSpy.mockRestore();
  });

  it('returns 0 + warn when the variable exists but is non-numeric', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const state: MatchStateBag = { edge: 'home' };
    const result = readStateVarOperation.compute(
      { var_name: 'edge' },
      CTX,
      state,
    );
    expect(result).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"edge" is missing or non-numeric'),
    );
    warnSpy.mockRestore();
  });

  it('returns 0 + warn defensively when args.var_name is not a string', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = readStateVarOperation.compute(
      { var_name: 42 },
      CTX,
      {},
    );
    expect(result).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('args.var_name must be a string'),
    );
    warnSpy.mockRestore();
  });

  it('declares its argsShape so the validator can check rows at load time', () => {
    expect(readStateVarOperation.argsShape).toEqual({
      var_name: { kind: 'state_var_name', required: true },
    });
  });
});
