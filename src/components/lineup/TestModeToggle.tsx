/**
 * @fileoverview Test Mode Toggle Component
 *
 * Provides a toggle to enable test mode for manual handicap overrides.
 * Used for testing specific match scenarios (ties, close games, blowouts).
 */

interface TestModeToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

/**
 * Test mode toggle for handicap overrides
 *
 * Allows users to manually set player handicaps for testing purposes.
 * When enabled, PlayerRoster component shows override dropdowns.
 */
export function TestModeToggle({
  enabled,
  onChange,
  disabled = false,
}: TestModeToggleProps) {
  return (
    <div className="bg-warning/10 border border-warning/40 rounded-lg p-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="w-4 h-4"
        />
        <span className="text-sm font-medium text-warning">
          Test Mode - Override Handicaps
        </span>
      </label>
      <p className="text-xs text-muted-foreground mt-1 ml-6">
        Enable to manually set handicaps for testing match scenarios
      </p>
    </div>
  );
}
