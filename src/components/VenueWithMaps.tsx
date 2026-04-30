/**
 * @fileoverview Venue Display with Maps Integration
 *
 * Reusable component that displays venue information with a clickable map icon.
 * When clicked, shows a confirmation dialog before opening the venue in Google Maps.
 * Fetches full venue data internally based on venue ID using TanStack Query.
 *
 * Usage:
 * <VenueWithMaps venueId={venueId} />
 * <VenueWithMaps venueId={venueId} className="custom-class" showIcon={false} />
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, ExternalLink } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/supabaseClient';
import type { Venue } from '@/types';

type VenueForMaps = Pick<Venue, 'id' | 'name' | 'street_address' | 'city' | 'state' | 'zip_code'>;

interface VenueWithMapsProps {
  venueId: string;
  className?: string;
  showIcon?: boolean; // Show MapPin icon (default true)
}

/**
 * Fetch venue data by ID
 */
async function fetchVenue(venueId: string): Promise<VenueForMaps> {
  const { data, error } = await supabase
    .from('venues')
    .select('id, name, street_address, city, state, zip_code')
    .eq('id', venueId)
    .single();

  if (error) throw error;
  if (!data) throw new Error('Venue not found');

  return data as VenueForMaps;
}

/**
 * Open venue location in Google Maps
 */
function openInMaps(venue: VenueForMaps) {
  // Build address string from available fields
  const addressParts = [
    venue.street_address,
    venue.city,
    venue.state,
    venue.zip_code,
  ].filter(Boolean);

  const address = addressParts.join(', ');
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  // Open in new tab
  window.open(mapsUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Reusable venue display with maps integration
 *
 * Fetches venue data by ID using TanStack Query and displays with a clickable
 * map icon that opens a confirmation dialog before launching Google Maps.
 */
export function VenueWithMaps({
  venueId,
  className,
  showIcon = true,
}: VenueWithMapsProps) {
  const [showDialog, setShowDialog] = useState(false);

  // Fetch venue data with TanStack Query
  const { data: venue, isLoading, isError } = useQuery({
    queryKey: ['venue', venueId],
    queryFn: () => fetchVenue(venueId),
    enabled: !!venueId,
  });

  const handleClick = () => {
    setShowDialog(true);
  };

  const handleOpenMaps = () => {
    if (venue) {
      openInMaps(venue);
      setShowDialog(false);
    }
  };

  if (isLoading) {
    return (
      <span className="text-muted-foreground text-sm">Loading venue...</span>
    );
  }

  if (isError || !venue) {
    return (
      <span className="text-muted-foreground text-sm">Venue not found</span>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          'flex items-center gap-1 text-left transition-colors cursor-pointer',
          className
        )}
      >
        {showIcon && <MapPin className="h-3 w-3 flex-shrink-0 text-blue-600 hover:text-blue-800" />}
        <span className="text-blue-600 hover:text-blue-800">
          {venue.name}
        </span>
      </button>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Open in Maps?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will open the following location in Google Maps:</p>
              <div className="bg-muted p-3 rounded-md">
                <p className="font-semibold text-foreground">{venue.name}</p>
                <p className="text-sm text-foreground">{venue.street_address}</p>
                <p className="text-sm text-foreground">
                  {venue.city}, {venue.state} {venue.zip_code}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleOpenMaps}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Maps
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
