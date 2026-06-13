/**
 * @fileoverview Duplicate Nickname Warning Component
 *
 * Displays a warning when multiple players in the lineup have the same nickname.
 * Players need unique nicknames for clear identification during scoring.
 */

interface DuplicateNicknameWarningProps {
  show: boolean;
}

export function DuplicateNicknameWarning({ show }: DuplicateNicknameWarningProps) {
  if (!show) return null;

  return (
    <div className="mb-4 p-3 bg-destructive/10 border border-destructive/40 rounded-md">
      <p className="text-sm text-destructive font-medium">
        ⚠️ Two or more players in your lineup have the same nickname.
      </p>
      <p className="text-xs text-destructive mt-1">
        Have at least one of them go to their profile page to change their
        nickname so they will be identifiable during scoring.
      </p>
    </div>
  );
}
