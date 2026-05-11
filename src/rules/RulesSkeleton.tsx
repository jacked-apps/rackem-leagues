/**
 * @fileoverview Suspense fallback for the lazy-loaded rules routes. Renders a
 * shape matching the eventual RulesPage layout (search row, game-picker row,
 * several rule-card placeholders) so the viewport does not shift when the
 * real content swaps in. Pure CSS — no skeleton library needed.
 */

function Bar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export function RulesSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Bar className="h-10 w-full" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Bar key={i} className="h-8 w-20" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Bar key={i} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}
