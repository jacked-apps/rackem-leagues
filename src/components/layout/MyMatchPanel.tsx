/**
 * @fileoverview Shared "My Match" panel — the chips + revealed match list used
 * by BOTH the mobile/tablet drawer (`AppDrawer`) and the desktop sidebar
 * (`AppSidebar`), so the two surfaces can't drift.
 *
 * Shows small filter chips ("Live" / "Makeup", each with a count); tapping one
 * reveals that group's list under a small heading. Radio-style: exactly one
 * chip is selected, defaulting to whichever group has matches (Live first); a
 * 0-count chip stays visible but dimmed + disabled. On phones (`< sm`) the chips
 * collapse to icons (Radio for Live, History for Makeup) to save room; from
 * `sm` up they show text labels.
 *
 * Rows lead with the date/detail and wrap long matchups ("vs OtherTeam" hangs
 * under the first team) instead of truncating. In the drawer the rows are
 * wrapped in `SheetClose` (tap closes the drawer); pass `inSheet` for that.
 *
 * Data comes from the shared `useMyMatchSurfaces` hook (the caller passes its
 * `drawerItems` + `isHydrating`).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SheetClose } from '@/components/ui/sheet';
import type { MyMatchDrawerItem } from '@/api/hooks/useMyMatchSurfaces';

/**
 * @param items - The member's relevant matches (`useMyMatchSurfaces().drawerItems`).
 * @param isHydrating - First-load flag; the header renders alone while loading.
 * @param inSheet - When true (drawer), wrap each row in `SheetClose` so a tap
 *   closes the drawer. Omit for the persistent sidebar.
 */
export function MyMatchPanel({
  items,
  isHydrating,
  inSheet = false,
}: {
  items: MyMatchDrawerItem[];
  isHydrating: boolean;
  inSheet?: boolean;
}) {
  const liveItems = items.filter((i) => i.group === 'live');
  const makeupItems = items.filter((i) => i.group === 'makeup');

  // Radio behavior: exactly one group is always selected (no "off" state).
  const [explicit, setExplicit] = useState<'live' | 'makeup' | null>(null);

  if (!isHydrating && items.length === 0) return null;

  const isPresent = (g: 'live' | 'makeup') =>
    g === 'live' ? liveItems.length > 0 : makeupItems.length > 0;
  const defaultSel: 'live' | 'makeup' | null =
    liveItems.length > 0 ? 'live' : makeupItems.length > 0 ? 'makeup' : null;
  const open = explicit && isPresent(explicit) ? explicit : defaultSel;

  return (
    <div className="mb-4 border-b pb-4">
      {/* "My Match" stays left; the chip pair is grouped and centered in the
          remaining space. Both chips always render — a 0-count one is dimmed
          and disabled (Live stays put even on a no-live night). */}
      <div className="flex items-center px-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          My Match
        </h3>
        {items.length > 0 ? (
          <div className="flex flex-1 items-center justify-center gap-1.5">
            <MyMatchChip
              kind="live"
              label="Live"
              count={liveItems.length}
              active={open === 'live'}
              disabled={liveItems.length === 0}
              onClick={() => setExplicit('live')}
            />
            <MyMatchChip
              kind="makeup"
              label="Makeup"
              count={makeupItems.length}
              active={open === 'makeup'}
              disabled={makeupItems.length === 0}
              onClick={() => setExplicit('makeup')}
            />
          </div>
        ) : null}
      </div>

      {open === 'live' ? <MyMatchList heading="Live" items={liveItems} inSheet={inSheet} /> : null}
      {open === 'makeup' ? (
        <MyMatchList heading="Makeup" items={makeupItems} inSheet={inSheet} />
      ) : null}
    </div>
  );
}

/**
 * A small, slim filter chip. On phones (`< sm`) it collapses to an icon — the
 * Radio "live" glyph for Live, the History glyph for Makeup — and from `sm` up
 * it shows the text label. A 0-count chip is disabled.
 */
function MyMatchChip({
  kind,
  label,
  count,
  active,
  disabled,
  onClick,
}: {
  kind: 'live' | 'makeup';
  label: string;
  count: number;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const icon =
    kind === 'live' ? (
      <Radio className="h-3.5 w-3.5" aria-hidden="true" />
    ) : (
      // History (clock + counter-clockwise arrow) — "catching up on an earlier
      // date" reads as a makeup match.
      <History className="h-3.5 w-3.5" aria-hidden="true" />
    );

  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      size="sm"
      loadingText="none"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      // Accessible name stays text-based even when only the icon shows on phones.
      aria-label={count > 0 ? `${label} ${count}` : label}
      className="h-6 gap-1 rounded-full px-2.5 text-[11px]"
    >
      <span className="flex items-center sm:hidden">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      {count > 0 ? <span className="tabular-nums opacity-70">{count}</span> : null}
    </Button>
  );
}

/** The revealed list of match rows for the open chip, under a small heading
 *  (the heading names the group, since the phone chip is just an icon). */
function MyMatchList({
  heading,
  items,
  inSheet,
}: {
  heading: string;
  items: MyMatchDrawerItem[];
  inSheet: boolean;
}) {
  return (
    <div className="mt-3">
      <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.matchId}>
            <MyMatchRow item={item} inSheet={inSheet} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One match row — leads with the date/detail, then the matchup. Long names
 *  wrap ("vs OtherTeam" drops under the first team) rather than truncating. In
 *  the drawer the row is wrapped in SheetClose so a tap closes the drawer. */
function MyMatchRow({ item, inSheet }: { item: MyMatchDrawerItem; inSheet: boolean }) {
  const link = (
    <Link
      to={item.destinationPath}
      className="flex min-h-11 items-baseline gap-2 rounded-md px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
    >
      {item.rowDetail ? (
        <span className="shrink-0 tabular-nums text-xs font-medium text-muted-foreground">
          {item.rowDetail}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-1">
        <span className="font-medium">{item.teamName}</span>
        <span className="text-muted-foreground">vs {item.opponentName}</span>
      </span>
    </Link>
  );

  return inSheet ? <SheetClose asChild>{link}</SheetClose> : link;
}
