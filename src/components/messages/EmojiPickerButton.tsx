/**
 * @fileoverview Emoji picker for the message composer (Unit 13).
 *
 * Renders a small smiley-face button. Tap opens a popover with the
 * 12-emoji curated set in a 4×3 grid (see `emojiSet.ts`). Tap an
 * emoji and it gets inserted at the current cursor position in the
 * parent's input — handled by the parent via `onPick` since this
 * component has no access to the input element itself.
 *
 * No external dependency — emojis are Unicode characters rendered by
 * the host OS font. A 12-button grid doesn't need a heavyweight
 * picker library.
 *
 * Closes itself on emoji pick. Standard shadcn `Popover` keyboard
 * behavior (Escape closes, click outside closes).
 */

import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Smile } from 'lucide-react';
import { EMOJI_SET } from './emojiSet';

interface EmojiPickerButtonProps {
  /** Called with the emoji string when the user taps one in the grid. */
  onPick: (emoji: string) => void;
  /** Disable the button (e.g., while sending). */
  disabled?: boolean;
}

export function EmojiPickerButton({ onPick, disabled }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Open emoji picker"
          disabled={disabled}
          className="flex h-11 w-11 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          data-testid="emoji-picker-trigger"
        >
          <Smile className="h-5 w-5 md:h-4 md:w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto p-2"
        data-testid="emoji-picker-content"
      >
        <div className="grid grid-cols-4 gap-1">
          {EMOJI_SET.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onPick(emoji);
                setOpen(false);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-md text-xl hover:bg-muted"
              data-testid={`emoji-pick-${emoji}`}
              aria-label={`Insert ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
