/**
 * @fileoverview Table Number Bar Component
 *
 * Displays the assigned table number on the scoring page.
 * Clickable to open a modal for changing the table number.
 * Players can enter any table number to easily update when
 * they get assigned to a different table than expected.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateMatch } from '@/api/mutations/matches';
import { queryKeys } from '@/api/queryKeys';
import { toast } from 'sonner';

interface TableNumberBarProps {
  /** Match ID for updating the table number */
  matchId: string;
  /** Current assigned table number (null if not assigned) */
  tableNumber: number | null;
  /** League ID for the spectator ("watch other matches") link. When provided,
   *  three icon-variants render on the right side so Ed can pick which he
   *  likes. The others will be removed once selected. */
  spectatorLeagueId?: string | null;
}

/**
 * TableNumberBar Component
 *
 * Shows the current table assignment and allows players to change it.
 * - Displays "Table X" if assigned, "Set Table Number" if not
 * - Clicking opens a modal to enter a new table number
 * - No restrictions on what number can be entered
 * - Leave empty to clear the assignment
 */
export function TableNumberBar({ matchId, tableNumber, spectatorLeagueId }: TableNumberBarProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const openSpectator = () => {
    if (!spectatorLeagueId) return;
    navigate(`/league/${spectatorLeagueId}/live`, {
      state: { from: `/match/${matchId}/score`, fromLabel: 'Back to Scoring' },
    });
  };

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Table number update mutation
  const updateTableNumberMutation = useMutation({
    mutationFn: (newTableNumber: number | null) =>
      updateMatch({
        matchId,
        updates: { assigned_table_number: newTableNumber },
      }),
    onSuccess: () => {
      toast.success('Table number updated');
      setShowModal(false);
      // Invalidate match queries to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.detail(matchId) });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update table number');
    },
  });

  /**
   * Handle opening the modal - pre-populate with current value
   */
  const handleOpen = () => {
    setInputValue(tableNumber?.toString() || '');
    setShowModal(true);
  };

  /**
   * Handle form submission
   */
  const handleSubmit = () => {
    const trimmed = inputValue.trim();
    if (trimmed === '') {
      // Clear the table number
      updateTableNumberMutation.mutate(null);
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num > 0) {
        updateTableNumberMutation.mutate(num);
      } else {
        toast.error('Please enter a valid table number');
      }
    }
  };

  return (
    <>
      {/* Table Number Bar: center holds the table-number button (click to
          change); the right side shows three icon variants for the spectator
          link so Ed can pick which he prefers. The whole row is a flex layout
          with the table-number button absolutely centered so spectator icons
          don't push it off-center. */}
      <div className="w-full bg-blue-50 border-b border-blue-100 relative">
        <button
          onClick={handleOpen}
          className="w-full px-4 py-2 text-center hover:bg-blue-100 transition-colors"
        >
          <span className="text-sm font-medium text-blue-800">
            {tableNumber ? `Table ${tableNumber}` : 'Set Table Number'}
          </span>
        </button>

        {spectatorLeagueId && (
          <div className="absolute top-0 right-0 h-full flex items-center pr-2 pointer-events-none">
            {/* TV icon + "Live" label. Label shown at sm breakpoint and up
                (desktop/tablet); icon-only on phone-sized viewports where
                horizontal space is tight. pointer-events-auto so the bar's
                table-number click still fires on the rest of the row. */}
            <button
              aria-label="Watch other live matches in this league"
              onClick={openSpectator}
              className="pointer-events-auto flex items-center gap-1.5 p-1.5 rounded hover:bg-blue-200 transition-colors text-blue-800"
            >
              <Tv className="h-5 w-5" />
              <span className="hidden sm:inline text-sm font-medium">Live</span>
            </button>
          </div>
        )}
      </div>

      {/* Table Number Change Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Change Table Number
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="table-number">Table Number</Label>
                <Input
                  id="table-number"
                  type="number"
                  min="1"
                  value={inputValue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
                  placeholder="Enter table number"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSubmit();
                    } else if (e.key === 'Escape') {
                      setShowModal(false);
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to clear the table assignment
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  disabled={updateTableNumberMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={handleSubmit}
                  disabled={updateTableNumberMutation.isPending}
                  isLoading={updateTableNumberMutation.isPending}
                  loadingText="Saving..."
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
