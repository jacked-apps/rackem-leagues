/**
 * @fileoverview "Entered in LMS" checkbox for a single finished match.
 *
 * Operators hand-type our results into CSI / FargoRate LMS and work it as a
 * backlog rather than weekly, so they need to see at a glance which matches are
 * already done. This is the one control that marks a match done, rendered in
 * both places the operator touches during that job:
 *
 *  - the match picker (`/manual-scoring`) — the at-a-glance backlog view
 *  - the printable results sheet — so they can tick it and hit Next without
 *    navigating back out
 *
 * The state is stored on the match and shared league-wide, so a second operator
 * doesn't re-enter a match their partner already did.
 *
 * State is conveyed by the checkbox shape AND the adjacent word ("Entered" /
 * "Not entered") — never by color alone.
 *
 * @see src/api/hooks/useLmsEntryMutations.ts — the mutation
 */

import { useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useSetMatchLmsEntered } from '@/api/hooks/useLmsEntryMutations';

interface LmsEnteredCheckboxProps {
  matchId: string;
  /** Current marker from the match row; NULL/undefined means not yet entered. */
  enteredAt: string | null | undefined;
  /** Season the match belongs to — lets the mutation refresh the picker list. */
  seasonId?: string;
  /** Extra classes for the wrapper (spacing differs between the two hosts). */
  className?: string;
}

/**
 * Checkbox + label marking whether a match's results are already in LMS.
 *
 * @param props - See {@link LmsEnteredCheckboxProps}
 * @returns The control, or `null` while it has no match to act on
 */
export function LmsEnteredCheckbox({
  matchId,
  enteredAt,
  seasonId,
  className,
}: LmsEnteredCheckboxProps) {
  const id = useId();
  const setEntered = useSetMatchLmsEntered();

  // While a write is in flight, render the value the operator just chose rather
  // than the prop. The mutation also patches the query caches, but this control
  // must not depend on that: the caches it patches are owned by two different
  // parents (the picker's season schedule, the sheet's match detail), and the
  // sheet's query is zero-staleTime, so a refetch can be racing us. Reading our
  // own intent makes the tick instant and identical in both hosts.
  const isEntered = setEntered.isPending
    ? setEntered.variables.entered
    : !!enteredAt;

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <Checkbox
        id={id}
        checked={isEntered}
        disabled={setEntered.isPending}
        onCheckedChange={(checked) =>
          setEntered.mutate({ matchId, entered: checked === true, seasonId })
        }
        aria-label={isEntered ? 'Entered in LMS' : 'Not yet entered in LMS'}
        data-testid="lms-entered-checkbox"
      />
      <Label htmlFor={id} className="cursor-pointer text-sm text-muted-foreground">
        {isEntered ? 'Entered' : 'Not entered'}
      </Label>
    </div>
  );
}
