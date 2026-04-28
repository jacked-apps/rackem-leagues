/**
 * @fileoverview Command-palette picker for selecting a CSI rule to override
 * or enhance. Loads entirely from the in-bundle rulebook — no network call.
 *
 * The value is the idMap key shape ("game:rule-id", e.g., "8-ball:2-2"),
 * which matches what `house_rules.related_rule_id` expects.
 */

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { rulebook } from './useRulebook';

type CsiRulePickerProps = {
  /** Current value as an idMap key ("game:ruleId") or null if unpicked. */
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
};

type Flat = { key: string; game: string; gameName: string; id: string; heading: string };

function flatten(): Flat[] {
  const out: Flat[] = [];
  for (const game of rulebook.index.games) {
    const rules = rulebook.rulesByGame[game.slug] ?? [];
    for (const rule of rules) {
      out.push({
        key: `${game.slug}:${rule.id}`,
        game: game.slug,
        gameName: game.name,
        id: rule.id,
        heading: rule.heading,
      });
    }
  }
  return out;
}

export function CsiRulePicker({ value, onChange, disabled = false }: CsiRulePickerProps) {
  const [open, setOpen] = useState(false);
  const allRules = useMemo(flatten, []);
  const current = value ? allRules.find((r) => r.key === value) ?? null : null;

  // Group by game for the list view.
  const byGame = useMemo(() => {
    const map = new Map<string, { name: string; rules: Flat[] }>();
    for (const r of allRules) {
      const bucket = map.get(r.game) ?? { name: r.gameName, rules: [] };
      bucket.rules.push(r);
      map.set(r.game, bucket);
    }
    return map;
  }, [allRules]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          loadingText="none"
          className="w-full min-h-11 justify-between font-normal"
        >
          {current ? (
            <span className="truncate">
              <span className="font-mono text-sm text-muted-foreground mr-2">{current.id}</span>
              {current.heading}
              <span className="ml-2 text-xs text-muted-foreground">({current.gameName})</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Pick the CSI rule this overrides or enhances…</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by rule id, heading, or game…" />
          <CommandList>
            <CommandEmpty>No rules match.</CommandEmpty>
            {[...byGame.entries()].map(([slug, { name, rules }]) => (
              <CommandGroup key={slug} heading={name}>
                {rules.map((r) => (
                  <CommandItem
                    key={r.key}
                    value={`${r.id} ${r.heading} ${r.gameName}`}
                    onSelect={() => {
                      onChange(r.key === value ? null : r.key);
                      setOpen(false);
                    }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${r.key === value ? 'opacity-100' : 'opacity-0'}`} />
                    <span className="font-mono text-sm text-muted-foreground mr-2">{r.id}</span>
                    <span>{r.heading}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
