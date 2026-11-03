/**
 * @fileoverview Tests for `useProfanityFilter`.
 *
 * Everyone respects their stored preference. The R4 under-18 lock is
 * paused (TODO(under-18-filter) in the hook), and the minor block below
 * pins that so it can't half-return. These tests pin the system clock so DOB-based assertions
 * stay deterministic regardless of when CI runs.
 *
 * Upstream hooks (`useUser`, `useMemberProfanitySettings`) are mocked at
 * module boundary so the test exercises only the hook's own logic, not
 * the React Query / Supabase plumbing underneath them.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUseUser = vi.fn();
const mockUseMemberProfanitySettings = vi.fn();

vi.mock('@/context/useUser', () => ({
  useUser: () => mockUseUser(),
}));

vi.mock('@/api/hooks', () => ({
  useMemberProfanitySettings: (userId: string | null | undefined) =>
    mockUseMemberProfanitySettings(userId),
}));

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { useProfanityFilter } from '../useProfanityFilter';

const FAKE_USER = { id: 'user-abc' };

function setSettings(data: unknown, opts: { isLoading?: boolean; error?: unknown } = {}) {
  mockUseMemberProfanitySettings.mockReturnValue({
    data,
    isLoading: opts.isLoading ?? false,
    error: opts.error ?? null,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 4, 12)); // 2026-05-12 local
  mockUseUser.mockReturnValue({ user: FAKE_USER });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useProfanityFilter — loading + error states', () => {
  it('returns isLoading: true while the settings query is loading', () => {
    setSettings(undefined, { isLoading: true });
    const { result } = renderHook(() => useProfanityFilter());
    expect(result.current).toEqual({
      shouldFilter: false,
      canToggle: true,
      isLoading: true,
    });
  });

  it('fails open (no forced filter, can toggle) when the query errors', () => {
    setSettings(undefined, { error: new Error('boom') });
    const { result } = renderHook(() => useProfanityFilter());
    expect(result.current).toEqual({
      shouldFilter: false,
      canToggle: true,
      isLoading: false,
    });
  });

  it('fails open when the query returns no data', () => {
    setSettings(null);
    const { result } = renderHook(() => useProfanityFilter());
    expect(result.current).toEqual({
      shouldFilter: false,
      canToggle: true,
      isLoading: false,
    });
  });
});

describe('useProfanityFilter — under-18 lock paused', () => {
  it('a known minor gets their stored preference and can toggle', () => {
    setSettings({ profanity_filter_enabled: false, date_of_birth: '2015-01-01' });
    const { result } = renderHook(() => useProfanityFilter());
    expect(result.current).toEqual({
      shouldFilter: false,
      canToggle: true,
      isLoading: false,
    });
  });
});

describe('useProfanityFilter — adults + unknown DOB respect stored preference', () => {
  it('returns the stored preference for adults (filter on)', () => {
    setSettings({ profanity_filter_enabled: true, date_of_birth: '1990-01-01' });
    const { result } = renderHook(() => useProfanityFilter());
    expect(result.current).toEqual({
      shouldFilter: true,
      canToggle: true,
      isLoading: false,
    });
  });

  it('returns the stored preference for adults (filter off)', () => {
    setSettings({ profanity_filter_enabled: false, date_of_birth: '1990-01-01' });
    const { result } = renderHook(() => useProfanityFilter());
    expect(result.current).toEqual({
      shouldFilter: false,
      canToggle: true,
      isLoading: false,
    });
  });

  it('respects stored preference when DOB is null (unknown age)', () => {
    setSettings({ profanity_filter_enabled: true, date_of_birth: null });
    const { result } = renderHook(() => useProfanityFilter());
    expect(result.current).toEqual({
      shouldFilter: true,
      canToggle: true,
      isLoading: false,
    });
  });

  it('coerces null/undefined profanity_filter_enabled to false', () => {
    setSettings({ profanity_filter_enabled: null, date_of_birth: null });
    const { result } = renderHook(() => useProfanityFilter());
    expect(result.current.shouldFilter).toBe(false);
    expect(result.current.canToggle).toBe(true);
  });
});
