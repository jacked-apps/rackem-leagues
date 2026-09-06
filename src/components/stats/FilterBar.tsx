/**
 * @fileoverview The filter controls above My Stats.
 *
 * Every control reads "All" until something is chosen, so the bar doubles as a
 * statement of what you are currently looking at. Options come from the
 * player's own games — never a venue they have not played — and each carries
 * its game count so a choice that would leave two games says so before it is
 * made.
 *
 * Options are built from the UNFILTERED history deliberately. Options that
 * vanished as you narrowed would leave no way to widen again from the control
 * itself.
 *
 * @see src/stats/gameFilters.ts
 */

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FilterOption, FilterOptions } from '@/stats/filterOptions';
import { HandicapFilter } from './HandicapFilter';
import { activeFilterCount, isUnfiltered, type GameFilter } from '@/stats/gameFilters';

/**
 * Sentinel for "no narrowing".
 *
 * A shadcn `SelectItem` cannot carry an empty string value, so "All" needs a
 * real one; it is mapped back to null at the boundary and never leaves this file.
 */
const ALL = '__all__';

interface FilterControlProps<T extends string | number> {
  label: string;
  /** Word shown when nothing is chosen — "All" reads better than "Any" for a set. */
  allLabel?: string;
  value: T | null;
  options: FilterOption<T>[];
  onChange: (value: T | null) => void;
  /** Turns the chosen string back into the option's own type. */
  parse: (raw: string) => T;
}

/** One labelled dropdown that defaults to All. */
function FilterControl<T extends string | number>({
  label,
  allLabel = 'All',
  value,
  options,
  onChange,
  parse,
}: FilterControlProps<T>) {
  // Hidden only when this dimension can never offer a choice — the option
  // builder returns nothing at all in that case. A control narrowed to ONE
  // option by the other filters stays visible: controls that appear and vanish
  // as you filter read as broken, and you would lose the way to widen again.
  if (options.length === 0 && value === null) return null;

  return (
    <div className="min-w-[10rem] flex-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select
        value={value === null ? ALL : String(value)}
        onValueChange={(raw) => onChange(raw === ALL ? null : parse(raw))}
      >
        <SelectTrigger>
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={String(option.value)} value={String(option.value)}>
              {option.label} ({option.count})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface FilterBarProps {
  filter: GameFilter;
  options: FilterOptions;
  onChange: (filter: GameFilter) => void;
  onReset: () => void;
  /** Games remaining after the current filter, so narrowing to nothing is visible. */
  matchCount: number;
}

/**
 * The filter bar.
 *
 * @param filter - Current selection.
 * @param options - What each control can offer.
 * @param onChange - Receives the whole updated filter.
 * @param onReset - Clears every control back to All.
 * @param matchCount - How many games currently match.
 */
export function FilterBar({
  filter,
  options,
  onChange,
  onReset,
  matchCount,
}: FilterBarProps) {
  const set = (patch: Partial<GameFilter>) => onChange({ ...filter, ...patch });
  const active = activeFilterCount(filter);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      {/* Grouped by the question each answers — who, what, how they are rated,
          where. The groups wrap as units, so a narrow screen never splits a
          pair across two lines and leaves a control stranded from its partner. */}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        {/* Who. Kept to one end rather than sitting between the two handicap
            controls, which belong side by side. */}
        <FilterControl
          label="Opponent"
          value={filter.opponentId}
          options={options.opponents}
          onChange={(opponentId) => set({ opponentId })}
          parse={(raw) => raw}
        />

        <FilterControl
          label="Game"
          value={filter.gameType}
          options={options.gameTypes}
          onChange={(gameType) => set({ gameType })}
          parse={(raw) => raw}
        />

        {/* The handicap pair. A handicap number means nothing without the
            system it is measured in, so the two travel together. */}
        <div className="flex min-w-[18rem] flex-[2] flex-wrap items-start gap-3">
          <FilterControl
            label="Handicap system"
            value={filter.handicapSystem}
            options={options.handicapSystems}
            onChange={(handicapSystem) => set({ handicapSystem })}
            parse={(raw) => raw}
          />
          {/* Pick-one by default, typed only for ranges — see HandicapFilter.
              Hidden entirely when no handicaps were recorded at all. */}
          {options.handicaps.length > 0 && (
            <HandicapFilter
              min={filter.opponentHandicapMin}
              max={filter.opponentHandicapMax}
              onChange={({ min, max }) =>
                set({ opponentHandicapMin: min, opponentHandicapMax: max })
              }
              options={options.handicaps}
            />
          )}
        </div>

        {/* Where. Venue and table are one question in two parts. */}
        <div className="flex min-w-[16rem] flex-1 flex-wrap items-start gap-3">
          <FilterControl
            label="Venue"
            value={filter.venueName}
            options={options.venues}
            onChange={(venueName) => set({ venueName })}
            parse={(raw) => raw}
          />
          <FilterControl
            label="Table"
            value={filter.tableNumber}
            options={options.tables}
            onChange={(tableNumber) => set({ tableNumber })}
            parse={Number}
          />
        </div>
      </div>

      {!isUnfiltered(filter) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {active} {active === 1 ? 'filter' : 'filters'} · {matchCount}{' '}
            {matchCount === 1 ? 'game' : 'games'}
          </p>
          <Button variant="outline" size="sm" onClick={onReset}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
