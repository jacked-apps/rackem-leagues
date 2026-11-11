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
  // Additive summary: only show rows that have actually been answered.
  // Empty labels (em-dash placeholders) make the panel feel "unfinished"
  // and bury the impressive list of facts behind blank rows.
  const answered = items.filter((i) => !!i.value);
  if (answered.length === 0) return null;

  // First answered item with a "name" or "title" label gets shown as a headline
  const headlineItem = answered.find(
    (i) => i.label.toLowerCase().includes('name'),
  );
  const detailItems = answered.filter((i) => i !== headlineItem);

  return (
    <div className="bg-info/10 border border-info/40 rounded-lg p-4">
      <h3 className="text-sm font-medium text-foreground mb-2">{title}</h3>

      {headlineItem?.value && (
        <p className="text-lg font-bold text-foreground mb-3 capitalize">
          {headlineItem.value}
        </p>
      )}

      <div className="space-y-1">
        {detailItems.map((item) => (
          <div key={item.label} className="flex justify-between text-sm">
            <span className="font-medium text-muted-foreground">{item.label}</span>
            {/* Value uses the theme `foreground` token so it stays readable
                against the theme-aware `bg-info/10` panel in both light and
                dark mode. */}
            <span className="text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
