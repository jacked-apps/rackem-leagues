/**
 * @fileoverview Shared add/edit form for house rules. Used by the org-wide
 * `LeagueRules` manager (Unit 5) and the league-specific section of
 * `LeagueSettings` (Unit 6). Parent owns the submit mutation — this form
 * only validates, normalizes, and hands values back.
 *
 * The effect-type switch hides `related_rule_id` for Standalone rules
 * without clearing the state, so toggling back restores what was picked
 * (R25). "Copy official text" prompts on overwrite when the body is
 * non-empty.
 */

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { CsiRulePicker } from './CsiRulePicker';
import { resolveRuleId } from './resolveRuleId';
import { rulebook } from './useRulebook';
import type {
  HouseRule,
  HouseRuleEffectType,
  HouseRuleFormValues,
} from './house-rules.types';

export type HouseRuleFormState = HouseRuleFormValues;

type Errors = Partial<Record<'title' | 'body' | 'related_rule_id', string>>;

type Props = {
  initial?: HouseRule | null;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: HouseRuleFormState) => void;
  /** Report dirty state up so the parent can wire `useBlocker`. */
  onDirtyChange?: (dirty: boolean) => void;
};

function defaults(initial: HouseRule | null | undefined): HouseRuleFormState {
  return {
    game: initial?.game ?? rulebook.index.defaultGame,
    effect_type: initial?.effect_type ?? 'standalone',
    related_rule_id: initial?.related_rule_id ?? null,
    title: initial?.title ?? '',
    body: initial?.body ?? [],
  };
}

function toTextarea(body: string[]): string {
  return body.join('\n\n');
}
function fromTextarea(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function HouseRuleForm({ initial, submitting = false, onCancel, onSubmit, onDirtyChange }: Props) {
  const base = useMemo(() => defaults(initial), [initial]);
  const [values, setValues] = useState<HouseRuleFormState>(base);
  const [bodyText, setBodyText] = useState<string>(() => toTextarea(base.body));
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    const dirty =
      values.title !== base.title ||
      values.effect_type !== base.effect_type ||
      values.related_rule_id !== base.related_rule_id ||
      values.game !== base.game ||
      bodyText !== toTextarea(base.body);
    onDirtyChange?.(dirty);
  }, [values, bodyText, base, onDirtyChange]);

  const needsCsi = values.effect_type === 'override' || values.effect_type === 'enhance';

  function validate(v: HouseRuleFormState, text: string): Errors {
    const e: Errors = {};
    if (v.title.trim().length === 0) e.title = 'Give this rule a short title.';
    if (text.trim().length === 0) e.body = 'Add the rule text.';
    if ((v.effect_type === 'override' || v.effect_type === 'enhance') && !v.related_rule_id) {
      e.related_rule_id = 'Choose a CSI rule above before saving.';
    }
    return e;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const next: HouseRuleFormState = {
      ...values,
      body: fromTextarea(bodyText),
      // Hide-but-don't-clear: Standalone rules submit `related_rule_id=null` even if one was picked.
      related_rule_id: needsCsi ? values.related_rule_id : null,
    };
    const e = validate(next, bodyText);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    onSubmit(next);
  }

  function copyOfficialText() {
    if (!values.related_rule_id) return;
    const [g, id] = values.related_rule_id.split(':');
    const csi = resolveRuleId(g, id);
    if (!csi) {
      toast.error("Couldn't find that CSI rule — pick a different one?");
      return;
    }
    const overwrite = bodyText.trim().length > 0;
    if (overwrite && !window.confirm('Replace the rule text with the official wording?')) return;
    setBodyText(csi.body.join('\n\n'));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label={initial ? 'Edit house rule' : 'Add house rule'}>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Effect</legend>
        <RadioGroup
          value={values.effect_type}
          onValueChange={(v) => setValues((s) => ({ ...s, effect_type: v as HouseRuleEffectType }))}
          className="flex gap-4"
        >
          {(['standalone', 'override', 'enhance'] as const).map((t) => (
            <div key={t} className="flex items-center space-x-2">
              <RadioGroupItem value={t} id={`effect-${t}`} />
              <Label htmlFor={`effect-${t}`} className="capitalize">{t}</Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="game">Game</Label>
        <Select value={values.game} onValueChange={(g) => setValues((s) => ({ ...s, game: g }))}>
          <SelectTrigger id="game" className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {rulebook.index.games.map((g) => (
              <SelectItem key={g.slug} value={g.slug}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {needsCsi ? (
        <div className="space-y-2">
          <Label>CSI rule this applies to</Label>
          <CsiRulePicker
            value={values.related_rule_id}
            onChange={(next) => setValues((s) => ({ ...s, related_rule_id: next }))}
          />
          {errors.related_rule_id ? <p className="text-sm text-destructive">{errors.related_rule_id}</p> : null}
          <Button type="button" variant="ghost" size="sm" loadingText="none" onClick={copyOfficialText} disabled={!values.related_rule_id}>
            Copy official text as a starting point
          </Button>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={values.title}
          onChange={(e) => setValues((s) => ({ ...s, title: e.target.value }))}
          onBlur={() => setErrors((e) => ({ ...e, title: validate(values, bodyText).title }))}
          placeholder="e.g., No jump cues"
        />
        {errors.title ? <p className="text-sm text-destructive">{errors.title}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Rule text</Label>
        <Textarea
          id="body"
          rows={6}
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          onBlur={() => setErrors((e) => ({ ...e, body: validate(values, bodyText).body }))}
          placeholder="One rule per paragraph. Separate paragraphs with a blank line."
        />
        {errors.body ? <p className="text-sm text-destructive">{errors.body}</p> : null}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" loadingText="none" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loadingText={submitting ? 'Saving…' : 'none'} disabled={submitting}>
          {initial ? 'Save changes' : 'Add rule'}
        </Button>
      </div>
    </form>
  );
}
