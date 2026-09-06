/**
 * @fileoverview One titled group on the hopper screen (Phase C, Unit C3).
 *
 * Presentational only — a heading with its live count, and either the rows or a
 * plain-English line explaining what would fill it. All three groups share this
 * so they read as one list broken into sections rather than three widgets.
 */

interface HopperGroupProps {
  title: string;
  count: number;
  /** What the organizer sees when the group is empty — say what fills it. */
  empty: string;
  children: React.ReactNode;
}

export function HopperGroup({ title, count, empty, children }: HopperGroupProps) {
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title} ({count})
      </h3>
      {count === 0 ? (
        <p className="px-2 py-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y">{children}</ul>
      )}
    </section>
  );
}
