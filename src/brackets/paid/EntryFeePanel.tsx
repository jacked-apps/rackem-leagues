/**
 * @fileoverview Entry-fee tracker panel (the `payment_tracker` premium feature).
 *
 * An organizer-only checklist of who has paid their tournament entry fee. The fee
 * is CASH the organizer collects outside the app — no money runs through us — so
 * this is purely a paid/unpaid list they toggle as players pay. Shown on the live
 * tournament view only when the tournament has the `payment_tracker` feature.
 */

import { useSetEntryFeePaid } from '@/api/hooks/useBrackets';
import { Checkbox } from '@/components/ui/checkbox';
import type { BracketParticipantRow } from '@/api/queries/brackets';

interface EntryFeePanelProps {
  bracketId: string;
  participants: BracketParticipantRow[];
  /** Closed tournaments are read-only. */
  readOnly?: boolean;
}

export function EntryFeePanel({ bracketId, participants, readOnly = false }: EntryFeePanelProps) {
  const setPaid = useSetEntryFeePaid(bracketId);
  const paidCount = participants.filter((p) => p.entry_fee_paid).length;

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Entry fees</h3>
        <span className="text-sm text-muted-foreground">
          {paidCount} of {participants.length} paid
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        You collect the cash — this is just your checklist.
      </p>

      <ul className="divide-y">
        {participants.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2">
            <Checkbox
              id={`fee-${p.id}`}
              checked={p.entry_fee_paid}
              disabled={readOnly || setPaid.isPending}
              onCheckedChange={(c) =>
                setPaid.mutate({ participantId: p.id, paid: c === true })
              }
            />
            <label
              htmlFor={`fee-${p.id}`}
              className={`flex-1 cursor-pointer text-sm ${
                p.entry_fee_paid ? '' : 'text-muted-foreground'
              }`}
            >
              {p.display_name}
            </label>
            <span
              className={`text-xs font-medium ${
                p.entry_fee_paid ? 'text-success' : 'text-muted-foreground'
              }`}
            >
              {p.entry_fee_paid ? 'Paid' : 'Unpaid'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
