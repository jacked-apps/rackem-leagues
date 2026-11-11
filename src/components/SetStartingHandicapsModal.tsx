/**
 * @fileoverview SetStartingHandicapsModal — operator dialog that sets a
 * player's starting handicaps (3v3 and 5v5).
 *
 * Opened from the operator-only "Set Starting H/C" action in the
 * `PlayerNameLink` popover. Extracted from `PlayerNameLink.tsx` so the name
 * link stays a name link: this dialog owns its own form state, validation and
 * save mutation.
 *
 * Behaviour:
 * - Each time it opens, the fields pre-fill from the player's current values,
 *   or the defaults (3v3 = 0, 5v5 = 40) when none are set yet.
 * - 3v3 must be -2..2, 5v5 must be 0..100; an out-of-range value shows a toast
 *   and nothing is saved.
 * - On save it refreshes the member detail plus the two operator lists that
 *   show starting handicaps (`unauthorizedPlayers`, `playerDetails`), toasts,
 *   and closes.
 *
 * @example
 * <SetStartingHandicapsModal
 *   open={open}
 *   onOpenChange={setOpen}
 *   playerId={id}
 *   playerName="Ben"
 *   current3v3={member.starting_handicap_3v3}
 *   current5v5={member.starting_handicap_5v5}
 * />
 */

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/api/queryKeys';
import { updatePlayerStartingHandicaps } from '@/api/queries/players';
import { logger } from '@/utils/logger';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

interface SetStartingHandicapsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** members.id of the player being edited. */
  playerId: string;
  /** Name shown in the description and the success toast. */
  playerName: string;
  /** The player's current 3v3 starting handicap; null/undefined = not set. */
  current3v3?: number | null;
  /** The player's current 5v5 starting handicap; null/undefined = not set. */
  current5v5?: number | null;
}

/** Number → select/input string, falling back to the default when unset. */
const toField = (value: number | null | undefined, fallback: string) =>
  value !== null && value !== undefined ? String(value) : fallback;

/**
 * Dialog for setting a player's starting handicaps.
 *
 * @param props - see {@link SetStartingHandicapsModalProps}
 * @returns the dialog (renders nothing visible while closed)
 */
export function SetStartingHandicapsModal({
  open,
  onOpenChange,
  playerId,
  playerName,
  current3v3,
  current5v5,
}: SetStartingHandicapsModalProps) {
  const queryClient = useQueryClient();
  const [handicap3v3, setHandicap3v3] = useState<string>('0');
  const [handicap5v5, setHandicap5v5] = useState<string>('40');

  // Pre-fill each time the dialog opens (not on every render), so an operator's
  // half-typed edit isn't wiped by a background refetch of the member.
  useEffect(() => {
    if (!open) return;
    setHandicap3v3(toField(current3v3, '0'));
    setHandicap5v5(toField(current5v5, '40'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open-edge only, see above
  }, [open]);

  const updateHandicapsMutation = useMutation({
    mutationFn: ({ h3v3, h5v5 }: { h3v3: number; h5v5: number }) =>
      updatePlayerStartingHandicaps(playerId, h3v3, h5v5),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.detail(playerId) });
      queryClient.invalidateQueries({ queryKey: ['unauthorizedPlayers'] });
      queryClient.invalidateQueries({ queryKey: ['playerDetails'] });
      toast.success(`Starting handicaps set for ${playerName}!`);
      onOpenChange(false);
    },
    onError: (error) => {
      logger.error('Error updating starting handicaps', {
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error('Failed to set starting handicaps. Please try again.');
    },
  });

  /** Validate both ranges, then save. Invalid input toasts and stops. */
  const handleSave = () => {
    const h3v3 = parseFloat(handicap3v3);
    const h5v5 = parseFloat(handicap5v5);

    if (isNaN(h3v3) || h3v3 < -2 || h3v3 > 2) {
      toast.error('Starting Handicap (3v3) must be between -2 and 2');
      return;
    }

    if (isNaN(h5v5) || h5v5 < 0 || h5v5 > 100) {
      toast.error('Starting Handicap (5v5) must be between 0 and 100');
      return;
    }

    updateHandicapsMutation.mutate({ h3v3, h5v5 });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Starting Handicaps</DialogTitle>
          <DialogDescription>
            Set starting handicaps for {playerName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current values display */}
          <div className="text-sm text-muted-foreground">
            Current: 3v3 = {current3v3 ?? 'Not set'}, 5v5 = {current5v5 ?? 'Not set'}
          </div>

          {/* 3v3 Handicap */}
          <div>
            <Label htmlFor="handicap3v3">Starting Handicap (3v3)</Label>
            <Select value={handicap3v3} onValueChange={setHandicap3v3}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select handicap" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-2">-2</SelectItem>
                <SelectItem value="-1">-1</SelectItem>
                <SelectItem value="0">0</SelectItem>
                <SelectItem value="1">+1</SelectItem>
                <SelectItem value="2">+2</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 5v5 Handicap */}
          <div>
            <Label htmlFor="handicap5v5">
              Starting Handicap (5v5)
              <span className="text-xs text-muted-foreground ml-2">(0 to 100)</span>
            </Label>
            <Input
              id="handicap5v5"
              type="number"
              step="1"
              min="0"
              max="100"
              value={handicap5v5}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHandicap5v5(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateHandicapsMutation.isPending}
            loadingText="Saving..."
            isLoading={updateHandicapsMutation.isPending}
          >
            Save Handicaps
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
