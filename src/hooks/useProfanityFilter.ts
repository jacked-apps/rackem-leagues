/**
 * @fileoverview useProfanityFilter Hook (TanStack Query Wrapper)
 *
 * Calculates the effective profanity filter setting for the current user.
 *
 * Two-tier rule:
 *   1. If we know the user is under 18 (DOB on file → `isMinor()` true),
 *      the filter is forced ON and the user cannot toggle it. This is the
 *      R4 under-18 enforcement path.
 *   2. Otherwise (adult OR unknown DOB), we respect the user's own
 *      `members.profanity_filter_enabled` preference and they can toggle
 *      it freely in settings.
 *
 * DOB is optional on the profile — some users will have it (CSI/BCA
 * partnerships may require it for identification), some won't.
 * `isMinor()` returns `false` for null/undefined DOB, so the fallback
 * path is automatic.
 *
 * @returns {Object} Profanity filter state
 * @property {boolean} shouldFilter - Whether profanity should be filtered for this user
 * @property {boolean} canToggle - Whether user can toggle filter (false for minors)
 * @property {boolean} isLoading - Whether data is still loading
 */

import { useMemo } from 'react';
import { useUser } from '@/context/useUser';
import { useMemberProfanitySettings } from '@/api/hooks';
import { isMinor } from '@/utils/age';
import { logger } from '@/utils/logger';

interface ProfanityFilterState {
  shouldFilter: boolean;
  canToggle: boolean;
  isLoading: boolean;
}

export function useProfanityFilter(): ProfanityFilterState {
  const { user } = useUser();
  const { data: settings, isLoading, error } = useMemberProfanitySettings(user?.id);

  return useMemo(() => {
    // Loading state
    if (isLoading) {
      return { shouldFilter: false, canToggle: true, isLoading: true };
    }

    // Error or no data — fail open (no forced filter, user can toggle).
    if (error || !settings) {
      logger.error('Error fetching member profanity filter settings', {
        error: error instanceof Error ? error.message : String(error),
        userId: user?.id
      });
      return { shouldFilter: false, canToggle: true, isLoading: false };
    }

    // R4: known-minor → filter forced ON, no toggle.
    if (isMinor(settings.date_of_birth)) {
      return { shouldFilter: true, canToggle: false, isLoading: false };
    }

    // Adult or unknown DOB → respect user's stored preference.
    return {
      shouldFilter: settings.profanity_filter_enabled || false,
      canToggle: true,
      isLoading: false,
    };
  }, [settings, isLoading, error, user?.id]);
}
