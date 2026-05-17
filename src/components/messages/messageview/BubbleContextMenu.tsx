/**
 * @fileoverview Right-click / long-press context menu wrapper for
 * message bubbles. Tiny menu (just "Copy" for now) that mirrors the
 * iMessage / WhatsApp / Slack pattern users instinctively reach for.
 *
 * Designed to grow — Reply, React, Edit, Delete, etc. all slot in
 * cleanly here later without touching MessageBubble itself.
 *
 * Implementation notes:
 *   - Built on shadcn Popover (no extra dependency) rather than
 *     installing the full @radix-ui/context-menu primitive — the
 *     menu is one item, doesn't need keyboard arrow nav, and Popover
 *     handles the click-outside / Escape close behavior we need.
 *   - Position is anchored to the bubble itself (not the cursor) to
 *     keep the trigger surface simple on touch. Acceptable trade-off
 *     for a one-item menu.
 *   - Long-press = 500ms pointer-down without movement; tunable.
 *   - We preventDefault on contextmenu so the native browser menu
 *     doesn't also appear.
 */

import { useRef, useState, type ReactNode } from 'react';
import { Copy } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface BubbleContextMenuProps {
  /** The bubble itself. Rendered inside the popover trigger. */
  children: ReactNode;
  /** The raw text to copy when "Copy" is selected. */
  content: string;
  /** Milliseconds the user must hold a pointer down (no movement)
   *  before the long-press counts. Default 500ms — long enough to
   *  not fire on accidental taps, short enough to feel responsive. */
  longPressMs?: number;
}

export function BubbleContextMenu({
  children,
  content,
  longPressMs = 500,
}: BubbleContextMenuProps) {
  const [open, setOpen] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copied');
    } catch {
      // Fallback for environments without clipboard API (older
      // browsers / non-secure contexts). Surface a soft failure
      // rather than crashing — copy isn't critical-path.
      toast.error('Copy failed');
    } finally {
      setOpen(false);
    }
  };

  // Long-press detection — start a timer on pointer-down, cancel
  // it on move or pointer-up. If the timer fires, open the menu.
  const startLongPress = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => setOpen(true), longPressMs);
  };
  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          onContextMenu={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
          onPointerDown={startLongPress}
          onPointerUp={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onPointerMove={cancelLongPress}
          // Trigger is the bubble itself — don't add visual chrome.
          className="contents"
        >
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-auto p-1"
        data-testid="bubble-context-menu"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="w-full justify-start gap-2 h-8 px-2"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy
        </Button>
      </PopoverContent>
    </Popover>
  );
}
