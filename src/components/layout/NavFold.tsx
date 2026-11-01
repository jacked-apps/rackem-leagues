/**
 * @fileoverview NavFold — a foldable menu group ("Non-league", "Info").
 *
 * A heading button opens and closes the group (shadcn Accordion underneath).
 * Each fold remembers whether it was left open or closed, per device, so a
 * Rules regular can leave Info open. That memory lives in localStorage
 * because it's a per-device habit and harmless to lose; every read and write
 * is wrapped in try/catch because storage can be blocked (private windows,
 * cleared site data) and the menu must still work. Folds start closed.
 */

import { useState, type ReactNode } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const storageKey = (id: string) => `nav-fold:${id}`;

function readOpen(id: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(id)) === 'open';
  } catch {
    return false;
  }
}

function writeOpen(id: string, open: boolean): void {
  try {
    window.localStorage.setItem(storageKey(id), open ? 'open' : 'closed');
  } catch {
    // Storage unavailable — the fold still works, it just won't remember.
  }
}

interface NavFoldProps {
  /** Stable id; also the storage key, so don't rename casually. */
  id: string;
  /** Heading text, including any "(New)" marker. */
  title: string;
  /** The fold's rows (`<NavRow>`s). */
  children: ReactNode;
}

/**
 * @example
 * <NavFold id="info" title={hasNew ? 'Info (New)' : 'Info'}>
 *   <NavRow to="/rules" label="Rules" />
 * </NavFold>
 */
export function NavFold({ id, title, children }: NavFoldProps) {
  const [open, setOpen] = useState(() => readOpen(id));

  const onValueChange = (value: string) => {
    const next = value === id;
    setOpen(next);
    writeOpen(id, next);
  };

  return (
    <Accordion type="single" collapsible value={open ? id : ''} onValueChange={onValueChange}>
      <AccordionItem value={id} className="border-b-0">
        {/* Same small uppercase look as the menu's other section headings. */}
        <AccordionTrigger className="min-h-11 items-center px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:no-underline">
          {title}
        </AccordionTrigger>
        <AccordionContent className="pb-2">
          <ul className="space-y-1">{children}</ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
