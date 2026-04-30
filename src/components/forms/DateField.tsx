/**
 * @fileoverview DateField Component
 * Reusable date input component that combines Calendar picker with timezone-safe formatting
 * Prevents the common timezone offset bug when displaying selected dates
 */
import React from 'react';
import { Calendar } from '@/components/ui/calendar';

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  error?: string;
  required?: boolean;
}

/**
 * DateField Component
 *
 * A complete date input solution that:
 * - Uses the Calendar component for date selection
 * - Provides timezone-safe date formatting for display
 * - Handles validation and error states
 * - Maintains consistent styling across the application
 */
export const DateField: React.FC<DateFieldProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  minDate,
  maxDate,
  error,
  required = false
}) => {

  /**
   * Format date string for display without timezone offset issues
   * @param dateString - ISO date string (YYYY-MM-DD)
   * @param format - 'short' for M/D/YYYY or 'long' for full format
   * @returns Formatted date string
   */
  const formatDateForDisplay = (dateString: string, format: 'short' | 'long' = 'short'): string => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');

    if (format === 'short') {
      return `${parseInt(month)}/${parseInt(day)}/${year}`;
    }

    // For long format, create date with explicit components to avoid timezone issues
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    const monthName = date.toLocaleDateString('en-US', { month: 'long' });

    return `${weekday}, ${monthName} ${parseInt(day)}, ${year}`;
  };

  return (
    <div className="space-y-2">
      {/* Label */}
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Calendar Input */}
      <Calendar
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        minDate={minDate}
        maxDate={maxDate}
      />

      {/* Selected Date Display */}
      {value && !error && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-2">
          Selected: {formatDateForDisplay(value, 'long')}
        </p>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
          {error}
        </p>
      )}
    </div>
  );
};

/**
 * Utility function for external use - format dates safely
 * @param dateString - ISO date string (YYYY-MM-DD)
 * @param format - 'short' for M/D/YYYY or 'long' for full format
 * @returns Formatted date string
 */
export const formatDateSafe = (dateString: string, format: 'short' | 'long' = 'short'): string => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');

  if (format === 'short') {
    return `${parseInt(month)}/${parseInt(day)}/${year}`;
  }

  // For long format, create date with explicit components to avoid timezone issues
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = date.toLocaleDateString('en-US', { month: 'long' });

  return `${weekday}, ${monthName} ${parseInt(day)}, ${year}`;
};