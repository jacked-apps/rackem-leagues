/**
 * @fileoverview Status Alert Component
 *
 * Displays success or error alerts for settings changes.
 * Auto-dismisses success messages after 3 seconds.
 */

interface StatusAlertProps {
  type: 'success' | 'error' | null;
  message: string;
}

export function StatusAlert({ type, message }: StatusAlertProps) {
  if (!type) return null;

  if (type === 'success') {
    return (
      <div className="p-3 bg-success/10 border border-success/40 rounded-md">
        <p className="text-sm text-success font-medium">{message}</p>
      </div>
    );
  }

  return (
    <div className="p-3 bg-destructive/10 border border-destructive/40 rounded-md">
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}
