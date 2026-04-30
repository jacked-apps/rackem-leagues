/**
 * @fileoverview WizardSummary — running summary of the user's choices
 *
 * Generic component that shows what the user has answered so far.
 * Displays answered items with values and unanswered items as dimmed
 * placeholders. Any wizard can use this by providing a list of items.
 *
 * Sits inside the WizardShell, always visible as the user progresses.
 */

export interface WizardSummaryItem {
  /** Label for this item (e.g., "Game Type") */
  label: string;
  /** Display value. Undefined = not yet answered. */
  value: string | undefined;
}

interface WizardSummaryProps {
  /** Heading for the summary box */
  title?: string;
  /** The items to display */
  items: WizardSummaryItem[];
}

export function WizardSummary({ title = 'Summary', items }: WizardSummaryProps) {
  // Don't render if no items have values yet
  const hasAnyValue = items.some((item) => item.value);
  if (!hasAnyValue) return null;

  // First item with a "name" or "title" label gets shown as a headline
  const headlineItem = items.find(
    (i) => i.value && i.label.toLowerCase().includes('name'),
  );
  const detailItems = items.filter((i) => i !== headlineItem);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-blue-900 mb-2">{title}</h3>

      {headlineItem?.value && (
        <p className="text-lg font-bold text-blue-900 mb-3 capitalize">
          {headlineItem.value}
        </p>
      )}

      <div className="space-y-1">
        {detailItems.map((item) => (
          <div key={item.label} className="flex justify-between text-sm">
            <span className="font-medium text-blue-800">{item.label}</span>
            {item.value ? (
              <span className="text-foreground">{item.value}</span>
            ) : (
              <span className="text-muted-foreground italic">—</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
