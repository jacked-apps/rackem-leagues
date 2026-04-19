/**
 * @fileoverview Rule detail page at `/rules/:game/:ruleId`.
 *
 * Resolves the URL params via `resolveRuleId`. If unknown, redirects to the
 * rulebook landing with a sonner toast explaining the rule no longer exists
 * (R9c). If known, renders the full rule view plus:
 *   - a drawer (shadcn Sheet) that lists every rule in the same game so a
 *     mobile reader can navigate within the game without going back to
 *     `/rules` (R6's drawer TOC requirement),
 *   - a Copy-link button for the share-link dispute flow,
 *   - the R11 Attribution footer.
 */

import { useEffect, useState } from 'react';
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

import { Attribution } from './Attribution';
import { CopyLinkButton } from './CopyLinkButton';
import { resolveRuleId } from './resolveRuleId';
import { RuleView } from './RuleView';
import { rulebook } from './useRulebook';

export default function RuleDetailPage() {
  const { game = '', ruleId = '' } = useParams<{ game: string; ruleId: string }>();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const rule = resolveRuleId(game, ruleId);

  // Unknown rule: toast + redirect to /rules. Using an effect so the render
  // stays a pure function of params and we don't navigate during render.
  useEffect(() => {
    if (rule) return;
    toast.error(`Rule ${ruleId || '?'} not found — showing all rules instead.`);
    navigate('/rules', { replace: true });
  }, [rule, ruleId, navigate]);

  if (!rule) return null;

  const gameMeta = rulebook.index.games.find((g) => g.slug === rule.game);
  const gameName = gameMeta?.name ?? rule.game;
  const siblings = rulebook.rulesByGame[rule.game] ?? [];

  return (
    <div>
      <PageHeader backTo="/rules" backLabel="All Rules" title={gameName} />

      <div className="mx-auto max-w-3xl p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" size="sm" loadingText="none" className="min-h-11 gap-2">
                <Menu className="h-4 w-4" />
                Browse {gameName}
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>{gameName} rules</SheetTitle>
                <SheetDescription>
                  Jump to another rule in this game.
                </SheetDescription>
              </SheetHeader>
              <nav aria-label={`Rules in ${gameName}`} className="flex-1 space-y-1 overflow-y-auto p-4">
                {siblings.map((sibling) => {
                  const isCurrent = sibling.id === rule.id;
                  return (
                    <SheetClose asChild key={sibling.id}>
                      <Link
                        to={`/rules/${sibling.game}/${sibling.id}`}
                        aria-current={isCurrent ? 'page' : undefined}
                        className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                          isCurrent
                            ? 'bg-accent text-accent-foreground font-medium'
                            : 'hover:bg-accent/50'
                        }`}
                      >
                        <span className="font-mono text-sm text-muted-foreground shrink-0">
                          {sibling.id}
                        </span>
                        <span>{sibling.heading}</span>
                      </Link>
                    </SheetClose>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>

          <CopyLinkButton />
        </div>

        <RuleView rule={rule} gameName={gameName} />

        <Attribution />
      </div>
    </div>
  );
}
