/**
 * @fileoverview DayOfWeekWarningModal Component
 * Modal component for warning users when changing the first season start date
 * would result in a different day of the week than the league's configured day.
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface DayOfWeekWarningModalProps {
  isOpen: boolean;
  oldDay: string;
  newDay: string;
  onAccept: () => void;
  onCancel: () => void;
}

/**
 * DayOfWeekWarningModal Component
 *
 * Displays a warning when the user changes the first season's start date.
 * Handles two cases:
 * 1. Day of week changes - warns that league will be updated
 * 2. Day of week same but date different - confirms the date change
 *
 * @param isOpen - Whether the modal is currently visible
 * @param oldDay - The current league day of week (e.g., "Monday")
 * @param newDay - The new day of week from the selected date (e.g., "Wednesday")
 * @param onAccept - Function to call when user accepts the change
 * @param onCancel - Function to call when user cancels the change
 */
export const DayOfWeekWarningModal: React.FC<DayOfWeekWarningModalProps> = ({
  isOpen,
  oldDay,
  newDay,
  onAccept,
  onCancel,
}) => {
  if (!isOpen) return null;

  const isDayChanging = oldDay !== newDay;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 max-w-md shadow-xl">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground mb-2">
              {isDayChanging ? 'Day of Week Change Detected' : 'Start Date Change Detected'}
            </h3>
            <div className="space-y-3 text-sm text-foreground">
              {isDayChanging ? (
                <>
                  <p>
                    You originally chose <strong>{oldDay}</strong> as your league
                    night, but the new start date you selected falls on a{' '}
                    <strong>{newDay}</strong>.
                  </p>

                  <p>
                    <strong>If you continue:</strong>
                  </p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>
                      Your league's day of the week will be updated from{' '}
                      <strong>{oldDay}</strong> to <strong>{newDay}</strong>
                    </li>
                    <li>All future seasons will default to {newDay}</li>
                    <li>This change will affect your league's public information</li>
                  </ul>

                  <p className="text-amber-700 font-medium">
                    Are you sure you want to change your league night to {newDay}?
                  </p>
                </>
              ) : (
                <>
                  <p>
                    You've selected a different <strong>{newDay}</strong> than you
                    originally chose as the first night of league play.
                  </p>

                  <p>
                    This date is earlier or later than your original selection.
                    Please verify this is the correct start date for your first season.
                  </p>

                  <p className="text-amber-700 font-medium">
                    Are you sure you want to use this new date?
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onAccept}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
          >
            {isDayChanging ? `Yes, Change to ${newDay}` : 'Yes, Use This Date'}
          </button>
        </div>
      </div>
    </div>
  );
};
