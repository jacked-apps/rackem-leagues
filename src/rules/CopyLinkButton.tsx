/**
 * @fileoverview One-tap "Copy link" button for the rule detail page.
 *
 * Writes the current page URL to the clipboard and fires a sonner toast so
 * the user knows it worked. The happy path is the only branch that matters
 * for the dispute-sharing flow; on clipboard failure (permissions, insecure
 * context) we fall back to an error toast rather than silently doing
 * nothing.
 */

import { Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

export function CopyLinkButton() {
  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
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
      aria-label="Copy link to this rule"
      className="min-h-11 gap-2"
    >
      <LinkIcon className="h-4 w-4" />
      Copy link
    </Button>
  );
}
