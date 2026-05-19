/**
 * @fileoverview Tests for `useProfanityFilter`.
 *
 * The hook's two-tier rule (minors forced ON, everyone else respects
 * their stored preference) is the R4 enforcement seam for messaging
 * Phase 1. These tests pin the system clock so DOB-based assertions
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

describe('useProfanityFilter — minor enforcement (R4)', () => {
  it('forces the filter ON and disables toggle for a known minor', () => {
    setSettings({ profanity_filter_enabled: false, date_of_birth: '2015-01-01' });
    const { result } = renderHook(() => useProfanityFilter());
    expect(result.current).toEqual({
      shouldFilter: true,
      canToggle: false,
      isLoading: false,
    });
  });

  it('forces ON even one day before the 18th birthday', () => {
    // 18th birthday lands on 2026-05-13; today is 2026-05-12 → still a minor.
    setSettings({ profanity_filter_enabled: false, date_of_birth: '2008-05-13' });
    const { result } = renderHook(() => useProfanityFilter());
    expect(result.current.shouldFilter).toBe(true);
    expect(result.current.canToggle).toBe(false);
  });

  it('does NOT force ON the day the user turns 18 — flips to adult', () => {
    setSettings({ profanity_filter_enabled: false, date_of_birth: '2008-05-12' });
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
