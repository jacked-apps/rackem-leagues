/**
 * @fileoverview Tests for the land-on-tonight's-match helper (Unit 8).
 */

import { describe, it, expect } from 'vitest';
import { defaultOpenTeamId } from './landingTeam';

describe('defaultOpenTeamId', () => {
  it('opens the team when there is exactly one', () => {
    expect(defaultOpenTeamId(['t1'])).toBe('t1');
  });

  it('opens nothing when there are several (no ambiguous guess)', () => {
    expect(defaultOpenTeamId(['t1', 't2'])).toBeUndefined();
  });

  it('opens nothing when there are no teams', () => {
    expect(defaultOpenTeamId([])).toBeUndefined();
  });
});
