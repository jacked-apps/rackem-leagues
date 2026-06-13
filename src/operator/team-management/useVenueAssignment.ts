/**
 * @fileoverview useVenueAssignment — all venue-side logic for the Manage Teams
 * surface: assign/unassign a venue, the select-all bulk toggle, the per-venue
 * table-limit modal, and venue creation. Owns its own UI state and talks to
 * Supabase directly (venues auto-persist; no deferred save). Extracted from
 * `src/operator/TeamManagement.tsx` as part of the content decomposition.
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { queryKeys } from '@/api/queryKeys';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import type { Venue, LeagueVenue } from '@/types/venue';

export function useVenueAssignment(
  leagueId: string | undefined,
  venues: Venue[],
  leagueVenues: LeagueVenue[],
) {
  const queryClient = useQueryClient();

  const [assigningVenueId, setAssigningVenueId] = useState<string | null>(null);
  const [selectingAll, setSelectingAll] = useState(false);
  const [limitModalVenue, setLimitModalVenue] = useState<{
    venue: Venue;
    leagueVenue: LeagueVenue;
  } | null>(null);
  const [showVenueCreation, setShowVenueCreation] = useState(false);

  const isVenueAssigned = (venueId: string): boolean =>
    leagueVenues.some((lv) => lv.venue_id === venueId);

  const areAllVenuesAssigned = (): boolean =>
    venues.length > 0 && venues.every((venue) => isVenueAssigned(venue.id));

  const invalidateVenues = async () => {
    if (!leagueId) return;
    await queryClient.invalidateQueries({
      queryKey: [...queryKeys.leagues.detail(leagueId), 'venues'],
    });
  };

  /** All table numbers a venue offers, combined + sorted. */
  const allTableNumbers = (venue: Venue): number[] =>
    [
      ...(venue.bar_box_table_numbers ?? []),
      ...(venue.eight_foot_table_numbers ?? []),
      ...(venue.regulation_table_numbers ?? []),
    ].sort((a, b) => a - b);

  const handleSelectAll = async () => {
    if (!leagueId || venues.length === 0) return;
    setSelectingAll(true);
    try {
      if (areAllVenuesAssigned()) {
        const { error } = await supabase.from('league_venues').delete().eq('league_id', leagueId);
        if (error) throw error;
      } else {
        const newLeagueVenues = venues
          .filter((venue) => !isVenueAssigned(venue.id))
          .map((venue) => {
            const tables = allTableNumbers(venue);
            return {
              league_id: leagueId,
              venue_id: venue.id,
              available_table_numbers: tables,
              capacity: tables.length,
            };
          });
        const { error } = await supabase.from('league_venues').insert(newLeagueVenues).select();
        if (error) throw error;
      }
      await invalidateVenues();
    } catch (err) {
      logger.error('Error selecting all venues', {
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error('Failed to update venues. Please try again.');
    } finally {
      setSelectingAll(false);
    }
  };

  const handleToggleVenue = async (venue: Venue) => {
    if (!leagueId) return;
    setAssigningVenueId(venue.id);
    try {
      if (isVenueAssigned(venue.id)) {
        const leagueVenue = leagueVenues.find((lv) => lv.venue_id === venue.id);
        if (!leagueVenue) return;
        const { error } = await supabase.from('league_venues').delete().eq('id', leagueVenue.id);
        if (error) throw error;
      } else {
        const tables = allTableNumbers(venue);
        const { error } = await supabase
          .from('league_venues')
          .insert([
            {
              league_id: leagueId,
              venue_id: venue.id,
              available_table_numbers: tables,
              capacity: tables.length,
            },
          ])
          .select()
          .single();
        if (error) throw error;
      }
      await invalidateVenues();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      logger.error('Error toggling venue', { error: message });
      toast.error(`Failed to update venue assignment: ${message}`);
    } finally {
      setAssigningVenueId(null);
    }
  };

  const handleOpenLimitModal = (venue: Venue) => {
    const leagueVenue = leagueVenues.find((lv) => lv.venue_id === venue.id);
    if (!leagueVenue) return;
    setLimitModalVenue({ venue, leagueVenue });
  };

  const handleLimitUpdateSuccess = async () => {
    await invalidateVenues();
    setLimitModalVenue(null);
  };

  const handleVenueCreated = () => {
    setShowVenueCreation(false);
    // Simple refresh for now — the venues query refetches on reload.
    window.location.reload();
  };

  return {
    assigningVenueId,
    selectingAll,
    limitModalVenue,
    showVenueCreation,
    isVenueAssigned,
    areAllVenuesAssigned,
    handleSelectAll,
    handleToggleVenue,
    handleOpenLimitModal,
    handleLimitUpdateSuccess,
    closeLimitModal: () => setLimitModalVenue(null),
    openVenueCreation: () => setShowVenueCreation(true),
    closeVenueCreation: () => setShowVenueCreation(false),
    handleVenueCreated,
  };
}
