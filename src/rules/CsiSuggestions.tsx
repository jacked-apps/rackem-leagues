/**
 * @fileoverview Live "similar official rules?" panel that appears under the
 * Title input in HouseRuleForm when the LO is drafting a Standalone rule.
 *
 * Surfaces CSI rules whose heading or body contains the words the LO is
 * typing, so they can notice "oh, this is actually an override of rule
 * 2-2" without learning the form's terminology first. Clicking a
 * suggestion hands it off to the parent, which flips effect_type to
 * Override and pre-selects the CSI rule.
 */

import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { searchRulebook, ALL_GAMES } from './useRulebookSearch';
import { rulebook } from './useRulebook';

type Props = {
  title: string;
  onPick: (key: string) => void;
  onDismiss: () => void;
};

const MAX_SUGGESTIONS = 4;

export function CsiSuggestions({ title, onPick, onDismiss }: Props) {
  const results = searchRulebook(title, ALL_GAMES).slice(0, MAX_SUGGESTIONS);
  if (results.length === 0) return null;

  return (
    <div className="mt-2 rounded-md border bg-primary/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium">
          Sounds like it might be related to an official rule. Is this one of them?
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          loadingText="none"
          aria-label="Dismiss suggestions"
          onClick={onDismiss}
          className="h-6 w-6"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <ul className="mt-2 space-y-1">
        {results.map((hit) => {
          const gameName =
            rulebook.index.games.find((g) => g.slug === hit.rule.game)?.name ?? hit.rule.game;
          const key = `${hit.rule.game}:${hit.rule.id}`;
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onPick(key)}
                className="flex w-full min-h-10 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span className="font-mono text-xs text-muted-foreground shrink-0">{hit.rule.id}</span>
                <span className="flex-1 truncate">{hit.rule.heading}</span>
                <span className="text-xs text-muted-foreground shrink-0">{gameName}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
