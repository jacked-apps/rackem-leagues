/**
 * @fileoverview One-tap "Copy link" button.
 *
 * Born on the rule detail page (copy THIS page for a dispute), now also used
 * by the Game Room's invite sheet (copy the room's join link). With no props
 * it behaves exactly as it always has: the current page URL, labelled for
 * the rule. Pass `url` to copy something else.
 *
 * Writes to the clipboard and fires a sonner toast so the user knows it
 * worked. On clipboard failure (permissions, insecure context) we fall back
 * to an error toast rather than silently doing nothing.
 */

import { Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

interface CopyLinkButtonProps {
  /** What to copy. Defaults to the current page URL, read at click time. */
  url?: string;
  /** Accessible label. Defaults to the rule page's. */
  ariaLabel?: string;
}

export function CopyLinkButton({ url, ariaLabel = 'Copy link to this rule' }: CopyLinkButtonProps) {
  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(url ?? window.location.href);
      toast.success('Link copied');
    } catch {
      toast.error("Couldn't copy link — try selecting the address bar instead");
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      loadingText="none"
      onClick={handleClick}
      aria-label={ariaLabel}
      className="min-h-11 gap-2"
    >
      <LinkIcon className="h-4 w-4" />
      Copy link
    </Button>
  );
}
