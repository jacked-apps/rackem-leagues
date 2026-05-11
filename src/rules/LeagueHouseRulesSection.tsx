/**
 * @fileoverview League-scoped house rules section for LeagueSettings.
 *
 * Wraps HouseRulesList with a per-league opt-out toggle that controls
 * whether this league inherits house rules from its parent organization.
 * When flipped on ("Use the official CSI rulebook only"), the reader
 * scoped to this league drops the org-wide rules from the cascade and
 * shows only this league's own rules plus the official rulebook.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/supabaseClient';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import { HouseRulesList } from './HouseRulesList';

type Props = { leagueId: string };

type LeagueFlag = { ignore_org_house_rules: boolean };

async function fetchLeagueFlag(leagueId: string): Promise<LeagueFlag> {
  const { data, error } = await supabase
    .from('leagues')
    .select('ignore_org_house_rules')
    .eq('id', leagueId)
    .maybeSingle();
  if (error) throw error;
  return { ignore_org_house_rules: (data?.ignore_org_house_rules as boolean | undefined) ?? false };
}

async function updateLeagueFlag(args: { leagueId: string; ignore: boolean }): Promise<void> {
  const { error } = await supabase
    .from('leagues')
    .update({ ignore_org_house_rules: args.ignore } as never)
    .eq('id', args.leagueId);
  if (error) throw error;
}

export function LeagueHouseRulesSection({ leagueId }: Props) {
  const qc = useQueryClient();
  const flagQuery = useQuery({
    queryKey: ['leagues', leagueId, 'ignore_org_house_rules'],
    queryFn: () => fetchLeagueFlag(leagueId),
    staleTime: 60 * 1000,
  });
  const [localFlag, setLocalFlag] = useState<boolean>(false);

  useEffect(() => {
    if (flagQuery.data) setLocalFlag(flagQuery.data.ignore_org_house_rules);
  }, [flagQuery.data]);

  const toggleMutation = useMutation({
    mutationFn: updateLeagueFlag,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rules', 'house'] });
      qc.invalidateQueries({ queryKey: ['leagues', leagueId, 'ignore_org_house_rules'] });
      toast.success('Saved.');
    },
    onError: (err) => toast.error(`Couldn't save: ${(err as Error).message}`),
  });

  function onToggle(next: boolean) {
    setLocalFlag(next);
    toggleMutation.mutate({ leagueId, ignore: next });
  }

  return (
    <section className="rounded-xl bg-card p-6 shadow-sm md:col-span-2" aria-label="League house rules">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">House rules for this league</h2>
          <p className="text-sm text-muted-foreground">
            Rules here apply to this league only. Org-wide rules cascade in automatically unless you opt out below.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" loadingText="none" className="gap-2 shrink-0">
          <Link to="/rules">
            <BookOpen className="h-4 w-4" />
            View the official rulebook
          </Link>
        </Button>
      </div>

      <div className="mb-6 flex items-start gap-2 rounded-md border bg-muted/30 p-3">
        <Checkbox
          id="ignore-org"
          checked={localFlag}
          onCheckedChange={(v) => onToggle(v === true)}
          disabled={flagQuery.isLoading || toggleMutation.isPending}
        />
        <div className="flex-1">
          <Label htmlFor="ignore-org" className="cursor-pointer font-medium">
            Use the official CSI rulebook only
          </Label>
          <p className="text-sm text-muted-foreground">
            Skip every house rule from the organization for this league. Only this league's own rules (below) and
            the official CSI rulebook will apply.
          </p>
        </div>
      </div>

      <HouseRulesList scope={{ type: 'league', leagueId }} />
    </section>
  );
}
