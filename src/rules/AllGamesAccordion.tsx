/**
 * @fileoverview Cover-to-cover view. Every game is collapsible so a reader
 * can expand just the section they care about without losing their place.
 *
 * The default open accordion is the rulebook's `defaultGame` slug so a cold
 * cover-to-cover visit lands on the same game the single-game tab view
 * defaults to (R5a consistency with R5).
 */

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import { GameTOC } from './GameTOC';
import { rulebook } from './useRulebook';

export function AllGamesAccordion() {
  return (
    <Accordion type="single" collapsible defaultValue={rulebook.index.defaultGame}>
      {rulebook.index.games.map((game) => {
        const rules = rulebook.rulesByGame[game.slug] ?? [];
        return (
          <AccordionItem key={game.slug} value={game.slug}>
            <AccordionTrigger className="text-base">
              {game.name}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({rules.length})
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <GameTOC rules={rules} />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
