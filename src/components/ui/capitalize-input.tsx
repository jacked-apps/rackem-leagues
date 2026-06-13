/**
 * @fileoverview Auto-Capitalize Input Component
 *
 * A self-contained text input with optional auto-capitalization functionality.
 * The component manages its own internal state (raw and formatted values).
 * Parent components only see the final output value via onChange.
 *
 * When auto-capitalize is enabled:
 * - Press Enter to preview capitalization
 * - Component always returns formatted value to parent
 * When disabled:
 * - Component returns raw value exactly as entered
 *
 * Default: auto-capitalize enabled
 */
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface CapitalizeInputProps {
  /** Initial/controlled value from parent */
  value: string;
  /** Change handler - receives formatted value if auto-capitalize is on, raw value if off */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Input ID for label association */
  id?: string;
  /** Label text */
  label?: string;
  /** Whether to show error state */
  error?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Whether auto-capitalize is enabled by default */
  defaultCapitalize?: boolean;
  /** Hide the checkbox and always capitalize (forces auto-capitalize on) */
  hideCheckbox?: boolean;
  /** Custom formatting function (defaults to title case) */
  formatFunction?: (text: string) => string;
  /** Whether to disable the input */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Maximum character length */
  maxLength?: number;
}

/**
 * Default title case formatter
 * Capitalizes first letter of each word
 */
const defaultFormat = (text: string): string => {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
};

/**
 * Auto-Capitalize Input Component
 *
 * @example
 * ```tsx
 * const [division, setDivision] = useState('');
 *
 * // The component handles capitalization internally
 * // setDivision will receive "East Division" if auto-capitalize is on
 * // or "east division" if auto-capitalize is off
 * <CapitalizeInput
 *   value={division}
 *   onChange={setDivision}
 *   label="Division Name"
 *   placeholder="e.g., East Division, Beginner"
 *   defaultCapitalize={true}
 * />
 * ```
 */
export const CapitalizeInput = React.forwardRef<
  { getValue: () => string },
  CapitalizeInputProps
>(({
  value,
  onChange,
  placeholder,
  id,
  label,
  error,
  errorMessage,
  defaultCapitalize = true,
  hideCheckbox = false,
  formatFunction = defaultFormat,
  disabled,
  className,
  maxLength,
}, ref) => {
  // Internal state for raw input value (what user types)
  const [internalValue, setInternalValue] = useState(value);

  // Auto-capitalize toggle state (forced on if hideCheckbox is true)
  const [autoCapitalize, setAutoCapitalize] = useState(hideCheckbox ? true : defaultCapitalize);

  // Track if value is being controlled externally (initial load only)
  const [isInitialized, setIsInitialized] = useState(false);

  // Sync internal value when external value changes (only on initial load)
  useEffect(() => {
    if (!isInitialized && value) {
      setInternalValue(value);
      setIsInitialized(true);
    }
  }, [value, isInitialized]);

  /**
   * Expose method to get the current value (formatted or raw based on checkbox)
   */
  React.useImperativeHandle(ref, () => ({
    getValue: () => {
      return (hideCheckbox || autoCapitalize) ? formatFunction(internalValue) : internalValue;
    }
  }));

  /**
   * Handle internal value changes
   * Always pass formatted or raw value to parent based on checkbox state
   */
  const handleChange = (newValue: string) => {
    // Enforce maxLength if provided
    if (maxLength && newValue.length > maxLength) {
      return; // Don't update state if exceeds max length
    }
    setInternalValue(newValue);

    // If auto-capitalize is on, send formatted value to parent
    // If auto-capitalize is off, send raw value to parent
    if (hideCheckbox || autoCapitalize) {
      onChange(formatFunction(newValue));
    } else {
      onChange(newValue);
    }
  };

  /**
   * Handle Enter key press - preview capitalization in the input field
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && (hideCheckbox || autoCapitalize) && internalValue.trim()) {
      e.preventDefault(); // Prevent form submission
      const formatted = formatFunction(internalValue);
      setInternalValue(formatted);
      onChange(formatted);
    }
  };

  return (
    <div className={className}>
      {label && (
        <Label htmlFor={id} className="block mb-2">
          {label}
        </Label>
      )}

      <Input
        id={id}
        type="text"
        value={internalValue}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={error ? 'border-destructive' : ''}
        maxLength={maxLength}
      />

      {errorMessage && error && (
        <p className="text-destructive text-sm mt-2">{errorMessage}</p>
      )}

      {/* Auto-Capitalize Toggle - hide if hideCheckbox is true */}
      {!hideCheckbox && (
        <div className="flex items-center space-x-2 mt-3">
          <input
            type="checkbox"
            id={`${id}-autocap`}
            checked={autoCapitalize}
            onChange={(e) => setAutoCapitalize(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-muted border-input rounded focus:ring-ring focus:ring-2"
            disabled={disabled}
          />
          <label
            htmlFor={`${id}-autocap`}
            className="text-sm text-muted-foreground select-none cursor-pointer"
          >
            {autoCapitalize
              ? "Auto-capitalize enabled (formatting applied when saved)"
              : "Auto-capitalize off (text will appear exactly as entered)"
            }
          </label>
        </div>
      )}
    </div>
  );
});

CapitalizeInput.displayName = 'CapitalizeInput';
