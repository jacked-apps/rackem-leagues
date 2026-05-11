/**
 * @fileoverview Playoff Weeks Card Component
 *
 * A reusable card component for displaying and configuring playoff weeks.
 * Shows a visual circle indicator with the current week count and provides
 * collapsible editing controls matching the ParticipationSettingsCard pattern.
 *
 * Features:
 * - Visual circle showing current playoff weeks count
 * - Collapsible edit panel with week selector
 * - "Add weeks..." option that opens a modal for purchasing additional weeks
 * - Modal with pricing calculator based on team count
 * - Payment method selection (automatic vs manual billing)
 *
 * This component uses the playoff settings reducer for state management.
 */

import React, { useState } from 'react';
import { Pencil, ChevronUp, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type {
  PlayoffSettingsState,
  PlayoffSettingsAction,
  PaymentMethod,
} from '@/hooks/playoff/usePlayoffSettingsReducer';

/**
 * Props for the PlayoffWeeksCard component
 */
export interface PlayoffWeeksCardProps {
  /** Current playoff settings state */
  settings: Pick<
    PlayoffSettingsState,
    | 'playoffWeeks'
    | 'showAddWeeksModal'
    | 'weeksToAdd'
    | 'paymentMethod'
    | 'exampleTeamCount'
  >;
  /** Dispatch function for updating settings */
  dispatch: React.Dispatch<PlayoffSettingsAction>;
}

/**
 * PlayoffWeeksCard Component
 *
 * Displays the current playoff weeks with a visual indicator and provides
 * collapsible editing controls. Matches the visual pattern of ParticipationSettingsCard.
 */
export const PlayoffWeeksCard: React.FC<PlayoffWeeksCardProps> = ({
  settings,
  dispatch,
}) => {
  // Local state for collapsible edit section
  const [showEdit, setShowEdit] = useState(false);

  const {
    playoffWeeks,
    showAddWeeksModal,
    weeksToAdd,
    paymentMethod,
    exampleTeamCount,
  } = settings;

  return (
    <>
      <div className="p-4 bg-purple-50 rounded-lg space-y-3">
        {/* Summary Row */}
        <div className="flex items-center gap-3">
          {/* Week Count Circle */}
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-600 text-white font-bold text-lg">
            {playoffWeeks}
          </div>

          {/* Description */}
          <div className="flex-1">
            <div className="font-medium text-purple-900">
              {playoffWeeks} Playoff Week{playoffWeeks !== 1 ? 's' : ''}
            </div>
            <div className="text-sm text-purple-700 mt-1">
              {playoffWeeks === 1 && 'Single round of play'}
              {playoffWeeks === 2 && 'Semi-final bracket'}
              {playoffWeeks === 3 && 'Quarter-final bracket'}
              {playoffWeeks >= 4 && 'Single elimination bracket'}
            </div>
          </div>

          {/* Edit Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEdit(!showEdit)}
            className="text-purple-700 hover:text-purple-900 hover:bg-purple-100"
            loadingText="none"
          >
            {showEdit ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <Pencil className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Collapsible Edit Section */}
        {showEdit && (
          <div className="pt-3 border-t border-purple-200 space-y-3">
            {/* Weeks Selector */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-800">Number of weeks</span>
              <Select
                value={playoffWeeks.toString()}
                onValueChange={(value) => {
                  if (value === 'add') {
                    dispatch({ type: 'OPEN_ADD_WEEKS_MODAL' });
                    return;
                  }
                  dispatch({ type: 'SET_PLAYOFF_WEEKS', payload: parseInt(value, 10) });
                }}
              >
                <SelectTrigger className="w-[140px] bg-card">
                  <SelectValue placeholder="Select weeks" />
                </SelectTrigger>
                <SelectContent>
                  {/* Dynamically generate options from 1 to current playoffWeeks count */}
                  {Array.from({ length: Math.max(2, playoffWeeks) }, (_, i) => i + 1).map((weekNum) => (
                    <SelectItem key={weekNum} value={weekNum.toString()}>
                      {weekNum} week{weekNum !== 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                  <SelectItem value="add">Add weeks...</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Add Weeks Modal */}
      <Dialog
        open={showAddWeeksModal}
        onOpenChange={(open) => {
          if (!open) dispatch({ type: 'CLOSE_ADD_WEEKS_MODAL' });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Playoff Weeks</DialogTitle>
            <DialogDescription>
              Additional playoff weeks are charged at $2 per team per week.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Number of weeks input */}
            <div className="space-y-2">
              <Label htmlFor="weeksToAdd"># of weeks to add</Label>
              <Input
                id="weeksToAdd"
                type="number"
                min={1}
                max={10}
                value={weeksToAdd}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  dispatch({ type: 'SET_WEEKS_TO_ADD', payload: parseInt(e.target.value) || 1 })
                }
                className="w-32"
              />
            </div>

            {/* Price calculation */}
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="text-xs text-muted-foreground mb-2">Example pricing based on {exampleTeamCount} teams:</div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price per team per week:</span>
                <span className="font-medium">$2.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Teams × Weeks:</span>
                <span className="font-medium">{exampleTeamCount} × {weeksToAdd}</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-medium text-foreground">Example total:</span>
                  <span className="font-bold text-purple-600">
                    ${(exampleTeamCount * weeksToAdd * 2).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-3">
              <Label>Payment method</Label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(value: string) =>
                  dispatch({ type: 'SET_PAYMENT_METHOD', payload: value as PaymentMethod })
                }
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted">
                  <RadioGroupItem value="automatic" id="automatic" />
                  <Label htmlFor="automatic" className="flex-1 cursor-pointer">
                    <div className="font-medium">Charge automatically</div>
                    <div className="text-xs text-muted-foreground">
                      Amount will be charged to your payment method during playoff weeks
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted">
                  <RadioGroupItem value="manual" id="manual" />
                  <Label htmlFor="manual" className="flex-1 cursor-pointer">
                    <div className="font-medium">Pay manually</div>
                    <div className="text-xs text-muted-foreground">
                      You will receive an invoice to pay before playoff weeks begin
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => dispatch({ type: 'CLOSE_ADD_WEEKS_MODAL' })}
              loadingText="none"
            >
              Cancel
            </Button>
            <Button
              onClick={() => dispatch({ type: 'ADD_PLAYOFF_WEEKS', payload: weeksToAdd })}
              className="bg-purple-600 hover:bg-purple-700"
              loadingText="none"
            >
              Add Weeks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PlayoffWeeksCard;
