/**
 * @fileoverview Tests for usePendingJoinRequestCount.
 *
 * The hook just derives a count from the shared approver feed, so the feed
 * hook is mocked and we assert the derivation (length, with a 0 fallback).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUseTeamJoinRequests = vi.fn();
vi.mock('./useTeamJoinRequests', () => ({
  useTeamJoinRequests: () => mockUseTeamJoinRequests(),
}));

import { usePendingJoinRequestCount } from './usePendingJoinRequestCount';

beforeEach(() => vi.clearAllMocks());

describe('usePendingJoinRequestCount', () => {
  it('returns the number of pending requests', () => {
    mockUseTeamJoinRequests.mockReturnValue({ data: [{}, {}, {}] });
    const { result } = renderHook(() => usePendingJoinRequestCount());
    expect(result.current).toBe(3);
  });

  it('returns 0 when there is no data (signed-out / non-approver)', () => {
    mockUseTeamJoinRequests.mockReturnValue({ data: undefined });
    const { result } = renderHook(() => usePendingJoinRequestCount());
    expect(result.current).toBe(0);
  });
});
