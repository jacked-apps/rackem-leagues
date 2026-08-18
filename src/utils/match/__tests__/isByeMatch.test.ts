/**
 * @fileoverview Unit tests for isByeMatch — the one shared "this matchup is a
 * BYE, not a real match" predicate used by every match-machinery guard.
 */

import { describe, it, expect } from 'vitest';
import { isByeMatch } from '../isByeMatch';

const active = { status: 'active' };
const bye = { status: 'bye' };

describe('isByeMatch', () => {
  it('is false when both sides are active', () => {
    expect(isByeMatch(active, active)).toBe(false);
  });

  it('is true when the home side is the BYE', () => {
    expect(isByeMatch(bye, active)).toBe(true);
  });

  it('is true when the away side is the BYE', () => {
    expect(isByeMatch(active, bye)).toBe(true);
  });

  it('is true when both sides are BYE (degenerate, still a bye)', () => {
    expect(isByeMatch(bye, bye)).toBe(true);
  });

  it('only "bye" status counts — a withdrawn team is not a bye here', () => {
    expect(isByeMatch({ status: 'withdrawn' }, active)).toBe(false);
  });

  it('treats a missing/undefined team as not-a-bye (NULL team is a separate concern)', () => {
    expect(isByeMatch(null, active)).toBe(false);
    expect(isByeMatch(active, undefined)).toBe(false);
    expect(isByeMatch(undefined, null)).toBe(false);
  });
});
