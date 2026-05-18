/**
 * @fileoverview SeasonExpensesCard — list + add UI for expense and
 * credit line items. Quick-add chips suggest common categories
 * (trophies, ink, banquet, sponsor cash, etc.) the LO might forget.
 *
 * Per Ed: "this is MOSTLY a tool to figure out prize payouts. the
 * rest is fluff and qol." So this card is intentionally lean —
 * just date + amount + description, with one-tap quick chips for
 * the common cases. No category taxonomy, no receipts upload, no
 * vendor management. The LO is keeping their own books; this is a
 * helper.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Receipt, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { useSeasonFinanceEntries, useAddFinanceEntry, useDeleteFinanceEntry } from '@/api/hooks/useSeasonFinanceEntries';
import { LoadingState } from '@/components/shared';

interface SeasonExpensesCardProps {
  seasonId: string;
}

interface QuickChip {
  label: string;
  emoji: string;
  defaultDescription: string;
  defaultLoFunded?: boolean;
}

const EXPENSE_CHIPS: QuickChip[] = [
  { label: 'Trophies', emoji: '🏆', defaultDescription: 'Trophies' },
  { label: 'Ink / paper', emoji: '🖨️', defaultDescription: 'Ink & paper' },
  { label: 'Banquet', emoji: '🍕', defaultDescription: 'End-of-season banquet' },
  { label: 'Shirts', emoji: '👕', defaultDescription: 'Team shirts' },
  { label: 'Sanctioning', emoji: '📋', defaultDescription: 'Sanctioning fees' },
  { label: 'LO gift', emoji: '🎁', defaultDescription: 'Outstanding Achievement award', defaultLoFunded: true },
];

const CREDIT_CHIPS: QuickChip[] = [
  { label: 'Sponsor cash', emoji: '💰', defaultDescription: 'Sponsor contribution' },
  { label: '50/50 raffle', emoji: '🎟️', defaultDescription: '50/50 raffle' },
];

export function SeasonExpensesCard({ seasonId }: SeasonExpensesCardProps) {
  const { data: entries = [], isLoading } = useSeasonFinanceEntries(seasonId);
  const addEntry = useAddFinanceEntry();
  const deleteEntry = useDeleteFinanceEntry();

  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'expense' | 'credit'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loFunded, setLoFunded] = useState(false);

  const lineItems = entries.filter((e) => e.entry_type !== 'dropped_team');
  const expenses = lineItems.filter((e) => e.entry_type === 'expense');
  const credits = lineItems.filter((e) => e.entry_type === 'credit');

  const totalExpenses = expenses
    .filter((e) => !e.lo_funded)
    .reduce((acc, e) => acc + (e.amount ?? 0), 0);
  const totalCredits = credits.reduce((acc, e) => acc + (e.amount ?? 0), 0);
  const totalLoFunded = expenses
    .filter((e) => e.lo_funded)
    .reduce((acc, e) => acc + (e.amount ?? 0), 0);

  const handleQuickAdd = (chip: QuickChip, type: 'expense' | 'credit') => {
    setShowForm(true);
    setFormType(type);
    setDescription(chip.defaultDescription);
    setLoFunded(chip.defaultLoFunded ?? false);
    setAmount('');
  };

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (!isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Enter a positive amount');
      return;
    }
    if (!description.trim()) {
      toast.error('Description required');
      return;
    }
    try {
      await addEntry.mutateAsync({
        seasonId,
        entryType: formType,
        amount: parsedAmount,
        description: description.trim(),
        loFunded: formType === 'expense' ? loFunded : false,
      });
      toast.success(`${formType === 'expense' ? 'Expense' : 'Credit'} added`);
      setAmount('');
      setDescription('');
      setLoFunded(false);
      setShowForm(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add');
    }
  };

  const handleDelete = async (entryId: string) => {
    try {
      await deleteEntry.mutateAsync({ entryId, seasonId });
      toast.success('Removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <LoadingState message="Loading expenses..." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Receipt className="h-5 w-5 text-orange-600" />
          Expenses + Credits
          <span className="text-sm font-normal text-muted-foreground ml-2">
            {expenses.length + credits.length} item{expenses.length + credits.length === 1 ? '' : 's'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary line */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <SummaryStat label="Expenses (from pool)" value={totalExpenses} color="text-red-700 dark:text-red-400" />
          <SummaryStat label="Credits (added)" value={totalCredits} color="text-green-700 dark:text-green-400" />
          <SummaryStat label="🎁 LO-funded" value={totalLoFunded} color="text-muted-foreground" tooltip="Doesn't affect the pool" />
        </div>

        {/* Quick-add chips */}
        {!showForm && (
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Quick-add expense:</div>
              <div className="flex flex-wrap gap-2">
                {EXPENSE_CHIPS.map((chip) => (
                  <Button
                    key={chip.label}
                    variant="outline"
                    size="sm"
                    loadingText="none"
                    onClick={() => handleQuickAdd(chip, 'expense')}
                    className="gap-1 h-8"
                  >
                    <span>{chip.emoji}</span>
                    {chip.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Quick-add credit:</div>
              <div className="flex flex-wrap gap-2">
                {CREDIT_CHIPS.map((chip) => (
                  <Button
                    key={chip.label}
                    variant="outline"
                    size="sm"
                    loadingText="none"
                    onClick={() => handleQuickAdd(chip, 'credit')}
                    className="gap-1 h-8"
                  >
                    <span>{chip.emoji}</span>
                    {chip.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Add form */}
        {showForm && (
          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="entry-amount">Amount ($)</Label>
                <Input
                  id="entry-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="entry-desc">Description</Label>
                <Input
                  id="entry-desc"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this for?"
                />
              </div>
            </div>
            {formType === 'expense' && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="lo-funded"
                  checked={loFunded}
                  onCheckedChange={(c) => setLoFunded(!!c)}
                />
                <Label htmlFor="lo-funded" className="cursor-pointer text-sm">
                  🎁 LO-funded (not from prize pool — comes out of my pocket)
                </Label>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                loadingText="none"
                onClick={() => {
                  setShowForm(false);
                  setAmount('');
                  setDescription('');
                  setLoFunded(false);
                }}
              >
                Cancel
              </Button>
              <Button
                loadingText="Adding..."
                isLoading={addEntry.isPending}
                onClick={handleSubmit}
              >
                Add {formType}
              </Button>
            </div>
          </div>
        )}

        {/* Existing entries list */}
        {lineItems.length > 0 && (
          <div className="border-t pt-3 space-y-1">
            {lineItems.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 py-2 px-2 rounded hover:bg-muted/50 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {entry.entry_type === 'expense' && entry.lo_funded ? (
                    <Gift className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  ) : entry.entry_type === 'expense' ? (
                    <Receipt className="h-4 w-4 text-red-600 flex-shrink-0" />
                  ) : (
                    <span className="text-green-600">💰</span>
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-medium">{entry.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(entry.entry_date).toLocaleDateString()}
                      {entry.entry_type === 'expense' && entry.lo_funded && ' • LO-funded'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={
                      entry.entry_type === 'credit'
                        ? 'text-green-700 dark:text-green-400 font-medium'
                        : entry.lo_funded
                          ? 'text-muted-foreground'
                          : 'text-red-700 dark:text-red-400 font-medium'
                    }
                  >
                    {entry.entry_type === 'credit' ? '+' : '−'}${(entry.amount ?? 0).toFixed(2)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    loadingText="none"
                    onClick={() => handleDelete(entry.id)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryStat({
  label,
  value,
  color,
  tooltip,
}: {
  label: string;
  value: number;
  color: string;
  tooltip?: string;
}) {
  return (
    <div className="text-center p-2 rounded bg-muted/30" title={tooltip}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>
        ${value.toFixed(2)}
      </div>
    </div>
  );
}
