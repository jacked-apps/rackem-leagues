/**
 * @fileoverview House rule detail page at
 * `/rules/house/:scope/:scopeId/:ruleId` (R18).
 *
 * Mirrors `RuleDetailPage`: PageHeader with a back link, a toolbar with
 * the drawer + Copy-link button, the shared RuleView, and an inline
 * attribution footer. The attribution swaps the official CSI block for
 * a scope-name header plus an override/enhance banner that links back
 * to the CSI rule whose behavior this one changes.
 *
 * Unknown rule / scope → redirect to `/rules` with a sonner toast so
 * stale share-links don't leave the user stranded.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';

import { CopyLinkButton } from './CopyLinkButton';
import { RuleView } from './RuleView';
import { useHouseRule, useHouseRulesForScope } from './useHouseRules';
import { rulesEvents } from './useRulesEvents';
import { resolveRuleId } from './resolveRuleId';
import { rulebook } from './useRulebook';
import type { HouseRule, HouseRuleScope, HouseRuleScopeType } from './house-rules.types';
import type { Rule } from './rulebook.types';

type RouteParams = {
  scope: HouseRuleScopeType;
  scopeId: string;
  ruleId: string;
};

/** Convert a HouseRule to the Rule shape expected by the shared RuleView. */
function toRule(hr: HouseRule): Rule {
  return {
    id: hr.id,
    game: hr.game,
    heading: hr.title,
    body: hr.body,
    order: 0,
  };
}

function buildScope(scope: HouseRuleScopeType, scopeId: string): HouseRuleScope {
  return scope === 'organization'
    ? { type: 'organization', organizationId: scopeId }
    : { type: 'league', leagueId: scopeId };
}

export default function HouseRuleDetailPage() {
  const { scope, scopeId = '', ruleId = '' } = useParams<RouteParams>();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const parsedScope = useMemo(
    () => (scope === 'organization' || scope === 'league' ? buildScope(scope, scopeId) : null),
    [scope, scopeId],
  );

  const rule = useHouseRule(ruleId);
  const siblings = useHouseRulesForScope(parsedScope);

  // Unknown rule or scope → toast + redirect.
  useEffect(() => {
    if (rule.isLoading || !parsedScope) return;
    if (rule.isError || rule.data === null) {
      toast.error('House rule not found — showing all rules instead.');
      navigate('/rules', { replace: true });
    }
  }, [rule.isLoading, rule.isError, rule.data, parsedScope, navigate]);

  // Log the deep-link open once we have a resolved rule.
  useEffect(() => {
    if (!rule.data) return;
    const r = rule.data;
    const scopeId = r.scope_type === 'organization' ? r.organization_id! : r.league_id!;
    rulesEvents.logHouseRuleOpened({ type: r.scope_type, id: scopeId }, r.id);
  }, [rule.data]);

  if (!parsedScope) {
    return null;
  }

  if (rule.isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-4 text-sm text-muted-foreground">Loading…</div>
    );
  }
  if (!rule.data) return null;

  const houseRule = rule.data;
  const siblingList = siblings.data ?? [];
  const scopeName = houseRule.scope_name;

  // CSI backlink for override/enhance rules.
  const linked = houseRule.related_rule_id ? parseRelated(houseRule.related_rule_id) : null;
  const linkedCsi = linked ? resolveRuleId(linked.game, linked.ruleId) : null;
  const linkedGameName = linked
    ? rulebook.index.games.find((g) => g.slug === linked.game)?.name ?? linked.game
    : null;

  return (
    <div>
      <PageHeader backTo="/rules" backLabel="All Rules" title={scopeName} />

      <div className="mx-auto max-w-3xl p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" size="sm" loadingText="none" className="min-h-11 gap-2">
                <Menu className="h-4 w-4" />
                Browse {scopeName}
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>{scopeName} house rules</SheetTitle>
                <SheetDescription>Jump to another house rule in this scope.</SheetDescription>
              </SheetHeader>
              <nav aria-label={`House rules in ${scopeName}`} className="flex-1 space-y-1 overflow-y-auto p-4">
                {siblingList.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">No other house rules in this scope.</p>
                ) : (
                  siblingList.map((sibling) => {
                    const isCurrent = sibling.id === houseRule.id;
                    return (
                      <SheetClose asChild key={sibling.id}>
                        <Link
                          to={`/rules/house/${sibling.scope_type}/${sibling.scope_type === 'organization' ? sibling.organization_id : sibling.league_id}/${sibling.id}`}
                          aria-current={isCurrent ? 'page' : undefined}
                          className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                            isCurrent ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-accent/50'
                          }`}
                        >
                          <span>{sibling.title}</span>
                        </Link>
                      </SheetClose>
                    );
                  })
                )}
              </nav>
            </SheetContent>
          </Sheet>

          <CopyLinkButton />
        </div>

        <RuleView rule={toRule(houseRule)} gameName={`House · ${scopeName}`} />

        <footer className="mt-8 rounded-md border bg-muted/30 p-4 text-sm">
          <p className="font-medium">{scopeName}</p>
          {linkedCsi && linked ? (
            <p className="mt-1 text-muted-foreground">
              {houseRule.effect_type === 'override' ? 'Overrides' : 'Enhances'}{' '}
              <Link to={`/rules/${linked.game}/${linked.ruleId}`} className="underline">
                CSI Rule {linkedCsi.id}
              </Link>{' '}
              ({linkedGameName}).
            </p>
          ) : houseRule.effect_type === 'standalone' ? (
            <p className="mt-1 text-muted-foreground">
              Added by this {houseRule.scope_type}. Not tied to a specific CSI rule.
            </p>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

/** Split an idMap key "game:ruleId" into its parts. */
function parseRelated(key: string): { game: string; ruleId: string } | null {
  const idx = key.indexOf(':');
  if (idx < 0) return null;
  return { game: key.slice(0, idx), ruleId: key.slice(idx + 1) };
}
