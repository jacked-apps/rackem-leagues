/**
 * @fileoverview Success Message Component
 * Displays success messages with change details after form updates
 */
import React from 'react';
import type { SuccessMessage as SuccessMessageType } from './types';

interface SuccessMessageProps {
  message: SuccessMessageType;
}

/**
 * Success Message Component
 *
 * Shows a temporary success notification when profile updates are completed.
 * Displays what specific fields were changed for user confirmation.
 */
export const SuccessMessage: React.FC<SuccessMessageProps> = ({ message }) => {
  if (!message.visible) return null;

  return (
    <div className="mb-6 bg-success/10 border border-success/40 rounded-lg p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-success"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-success">
            {message.type} Updated Successfully
          </h3>
          {message.changes.length > 0 && (
            <div className="mt-2 text-sm text-foreground">
              <p className="font-medium">Changes made:</p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                {message.changes.map((change, index) => (
                  <li key={index} className="font-mono text-xs">
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};