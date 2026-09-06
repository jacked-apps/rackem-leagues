/**
 * @fileoverview Whether a member has read the current release notes.
 *
 * Drives the "New" marker in the nav, and clears it when the page is opened.
 *
 * Stored on the member rather than in browser storage: reading the notes on a
 * laptop should clear the marker on a phone.
 *
 * @see docs/plans/2026-09-05-002-feat-whats-new-plan.md
 */

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { useCurrentMember } from '@/api/hooks';
import { latestReleasedVersion } from './releaseSelectors';

/**
 * True when there are shipped notes this member hasn't opened.
 *
 * Deliberately false in three cases:
 *  - nothing has shipped yet (nothing to announce)
 *  - the member isn't loaded (don't flash a marker mid-load)
 *  - the newest release is the one they've already seen
 *
 * The comparison uses the newest SHIPPED release, never the unreleased block —
 * a user shouldn't be told about something that hasn't gone out.
 *
 * @returns Whether to show the marker
 */
export function useHasUnseenWhatsNew(): boolean {
  const { data: member } = useCurrentMember();
  const latest = latestReleasedVersion();

  if (!latest || !member) return false;
  return member.last_seen_whats_new !== latest;
}

/**
 * Records that this member has now seen the current notes.
 *
 * Safe to call on every page view — it no-ops when already up to date, so
 * opening the page repeatedly doesn't write repeatedly.
 *
 * @returns A stable callback to invoke when the page is shown
 */
export function useMarkWhatsNewSeen(): () => void {
  const { data: member } = useCurrentMember();
  const queryClient = useQueryClient();
  const memberId = member?.id;
  const alreadySeen = member?.last_seen_whats_new;
  const latest = latestReleasedVersion();

  const mutation = useMutation({
    mutationFn: async (version: string) => {
      const { error } = await supabase
        .from('members')
        .update({ last_seen_whats_new: version })
        .eq('id', memberId!);
      if (error) {
        throw new Error(`Failed to record What's New as seen: ${error.message}`);
      }
    },
    onSuccess: () => {
      // The nav marker reads this off the member record.
      queryClient.invalidateQueries({ queryKey: ['currentMember'] });
    },
  });

  const { mutate } = mutation;

  return useCallback(() => {
    // Nothing shipped, nobody logged in, or already recorded — a logged-out
    // visitor can read the page freely, there's just nowhere to record it.
    if (!latest || !memberId || alreadySeen === latest) return;
    mutate(latest);
  }, [latest, memberId, alreadySeen, mutate]);
}
