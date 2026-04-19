/**
 * @fileoverview Unit tests for `resolveRuleId`.
 *
 * Exercises the happy path against known rules in the committed cleaned
 * rulebook plus the two "not found" branches (unknown ruleId, unknown game).
 */

import { describe, expect, it } from 'vitest';

import { resolveRuleId } from '@/rules/resolveRuleId';

describe('resolveRuleId', () => {
  it('returns a rule when (game, ruleId) is known', () => {
    const rule = resolveRuleId('9-ball', '3-1');
    expect(rule).not.toBeNull();
    expect(rule?.id).toBe('3-1');
    expect(rule?.game).toBe('9-ball');
    expect(rule?.heading).toBe('The Game');
    expect(rule?.body.length).toBeGreaterThan(0);
  });

  it('also resolves rules in games whose slug has hyphens (10-ball)', () => {
    const rule = resolveRuleId('10-ball', '4-1');
    expect(rule).not.toBeNull();
    expect(rule?.game).toBe('10-ball');
  });

  it('returns null for a rule ID that does not exist in the given game', () => {
    expect(resolveRuleId('9-ball', '9-99')).toBeNull();
  });

  it('returns null when the game slug is unknown', () => {
    expect(resolveRuleId('ghost-pool', '3-1')).toBeNull();
  });

  it('returns null when both game and ruleId are nonsense', () => {
    expect(resolveRuleId('', '')).toBeNull();
  });

  it('is case-sensitive on the game slug', () => {
    // Our URL shape normalizes slugs to lowercase; upstream routing is
    // responsible for passing the canonical slug. Confirm the lookup does
    // not silently match "9-BALL" against "9-ball".
    expect(resolveRuleId('9-BALL', '3-1')).toBeNull();
  });
});
