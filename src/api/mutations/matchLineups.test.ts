/**
 * @fileoverview Lineup writes: the "are you on this team?" check.
 *
 * A failed lookup (no connection) and a lookup that finds no roster row used
 * to share one message, "You are not a member of this team", so a captain on
 * bad wifi tapping Lock was told the wrong thing. These tests pin the split.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lockMatchLineup } from './matchLineups';

const maybeSingle = vi.fn();

vi.mock('@/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }),
    })),
  },
}));

const params = { lineupId: 'l1', teamId: 't1', memberId: 'm1' };

describe('lineup writes — team membership check', () => {
  beforeEach(() => maybeSingle.mockReset());

  it('says it could not reach the server when the lookup fails', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
    await expect(lockMatchLineup(params)).rejects.toThrow("Couldn't reach the server");
  });

  it('says not a member only when the lookup works and finds no row', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(lockMatchLineup(params)).rejects.toThrow('You are not a member of this team');
  });
});
