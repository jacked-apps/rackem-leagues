/**
 * @fileoverview Saved operator-application progress belongs to one account.
 *
 * Bug (Ed, 2026-11-19): a brand-new account opened the application on step 3
 * of 6 — another account's half-finished progress saved in the same browser.
 * Rules:
 *   - Another account's saved progress is wiped: start at step 1, blank answers.
 *   - The same account resumes its own step and answers.
 *   - Progress saved before owners were recorded (no owner) is wiped too.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { UserContext } from '@/context/UserContext';
import { useApplicationForm } from './useApplicationForm';

vi.mock('@/api/hooks', () => ({ useUserProfile: () => ({ member: null }) }));

const DATA_KEY = 'leagueOperatorApplication';
const STEP_KEY = 'leagueOperatorApplication_currentStep';
const OWNER_KEY = 'leagueOperatorApplication_owner';

function renderAs(userId: string) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <UserContext.Provider
      value={{
        user: { id: userId } as User,
        isLoggedIn: true,
        loading: false,
        logout: () => {},
        setUser: () => {},
        setIsLoggedIn: () => {},
      }}
    >
      {children}
    </UserContext.Provider>
  );
  return renderHook(() => useApplicationForm(), { wrapper });
}

/** Account A left its application on step 3 (index 2) with a league name typed. */
function savedBy(owner: string | null) {
  localStorage.setItem(DATA_KEY, JSON.stringify({ leagueName: 'Account A League' }));
  localStorage.setItem(STEP_KEY, '2');
  if (owner) localStorage.setItem(OWNER_KEY, owner);
}

beforeEach(() => localStorage.clear());

describe('operator application progress is per account', () => {
  it("a different account starts at step 1 with none of the other account's answers", () => {
    savedBy('account-a');
    const { result } = renderAs('account-b');
    expect(result.current.currentStep).toBe(0);
    expect(result.current.state.leagueName).toBe('');
    expect(localStorage.getItem(OWNER_KEY)).toBe('account-b');
  });

  it('the same account picks up where it left off', () => {
    savedBy('account-a');
    const { result } = renderAs('account-a');
    expect(result.current.currentStep).toBe(2);
    expect(result.current.state.leagueName).toBe('Account A League');
  });

  it('progress saved with no owner on record is not handed to whoever signs in', () => {
    savedBy(null);
    const { result } = renderAs('account-b');
    expect(result.current.currentStep).toBe(0);
    expect(result.current.state.leagueName).toBe('');
  });
});
