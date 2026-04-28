/**
 * @fileoverview Reusable list of house rules for an LO scope. Supports
 * inline add/edit/delete with a 10-second Undo on deletes that preserves
 * the original `id` so deep-links keep resolving (R27).
 *
 * Actions are rendered unconditionally — RLS is the real enforcement. A
 * non-writer who clicks Add/Edit/Delete will see a 403 surface via the
 * mutation's error toast; keeping the UI uniform avoids duplicating auth
 * state here.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { HouseRuleForm } from './HouseRuleForm';
import { useHouseRulesForScope } from './useHouseRules';
import {
  createHouseRule,
  deleteHouseRule,
  reinsertHouseRule,
  updateHouseRule,
} from '@/api/mutations/houseRules';
import type {
  HouseRule,
  HouseRuleFormValues,
  HouseRuleScope,
} from './house-rules.types';

type Mode = { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; rule: HouseRule };

type Props = { scope: HouseRuleScope };

export function HouseRulesList({ scope }: Props) {
  const qc = useQueryClient();
  const { data: rules = [], isLoading } = useHouseRulesForScope(scope);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [pendingDelete, setPendingDelete] = useState<HouseRule | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['rules', 'house'] });
  };

  const createMutation = useMutation({
    mutationFn: (values: HouseRuleFormValues) => createHouseRule(scope, values),
    onSuccess: () => {
      toast.success('House rule added.');
      invalidate();
      setMode({ kind: 'list' });
    },
    onError: (err) => toast.error(`Couldn't add rule: ${(err as Error).message}`),
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; values: HouseRuleFormValues }) =>
      updateHouseRule(args.id, args.values),
    onSuccess: () => {
      toast.success('House rule updated.');
      invalidate();
      setMode({ kind: 'list' });
    },
    onError: (err) => toast.error(`Couldn't save: ${(err as Error).message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHouseRule,
    onError: (err) => toast.error(`Couldn't delete: ${(err as Error).message}`),
  });

  if (mode.kind === 'add') {
    return (
      <section aria-label="Add a house rule" className="space-y-4">
        <h3 className="text-lg font-semibold">Add a house rule</h3>
        <HouseRuleForm
          onCancel={() => setMode({ kind: 'list' })}
          onSubmit={(v) => createMutation.mutate(v)}
          submitting={createMutation.isPending}
        />
      </section>
    );
  }

  if (mode.kind === 'edit') {
    return (
      <section aria-label="Edit house rule" className="space-y-4">
        <h3 className="text-lg font-semibold">Edit house rule</h3>
        <HouseRuleForm
          initial={mode.rule}
          onCancel={() => setMode({ kind: 'list' })}
          onSubmit={(v) => updateMutation.mutate({ id: mode.rule.id, values: v })}
          submitting={updateMutation.isPending}
        />
      </section>
    );
  }

  return (
    <section aria-label="House rules" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">House rules</h3>
        <Button type="button" size="sm" loadingText="none" onClick={() => setMode({ kind: 'add' })}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No house rules yet. Click <span className="font-medium">Add</span> to create one.
        </p>
      ) : (
        <ul className="space-y-2">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-start justify-between gap-3 rounded-md border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{rule.title}</p>
                <p className="text-xs text-muted-foreground">
                  {rule.effect_type === 'standalone'
                    ? 'Standalone'
                    : `${rule.effect_type === 'override' ? 'Overrides' : 'Enhances'} CSI ${rule.related_rule_id?.split(':')[1] ?? '?'}`}
                  {' · '}
                  {rule.game}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  loadingText="none"
                  aria-label={`Edit ${rule.title}`}
                  onClick={() => setMode({ kind: 'edit', rule })}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  loadingText="none"
                  aria-label={`Delete ${rule.title}`}
                  onClick={() => setPendingDelete(rule)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this house rule?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll have 10 seconds to undo from the toast.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) {
                  const row = pendingDelete;
                  deleteMutation.mutate(row.id, {
                    onSuccess: () => {
                      invalidate();
                      toast('House rule deleted.', {
                        duration: 10000,
                        action: {
                          label: 'Undo',
                          onClick: () => {
                            reinsertHouseRule(row)
                              .then(() => {
                                invalidate();
                                toast.success('Restored.');
                              })
                              .catch((err) => toast.error(`Couldn't undo: ${err.message}`));
                          },
                        },
                      });
                    },
                  });
                  setPendingDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
