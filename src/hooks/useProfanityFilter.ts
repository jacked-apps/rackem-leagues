/**
 * @fileoverview useProfanityFilter Hook (TanStack Query Wrapper)
 *
 * Calculates the effective profanity filter setting for the current user.
 *
 * Everyone respects their own `members.profanity_filter_enabled` preference
 * and can toggle it in settings. The R4 under-18 lock (forced ON for a known
 * minor) is PAUSED — see the TODO(under-18-filter) in the hook body.
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

    // TODO(under-18-filter): the R4 minor lock (filter forced ON, no toggle
    // when isMinor(settings.date_of_birth)) is paused — everyone gets their
    // own choice until Ed revisits it. Restore it together with the matching
    // check in updateProfanityFilter. `canToggle` stays so the screens'
    // locked state is ready to come back.
    return {
      shouldFilter: settings.profanity_filter_enabled || false,
      canToggle: true,
      isLoading: false,
    };
  }, [settings, isLoading, error, user?.id]);
}
