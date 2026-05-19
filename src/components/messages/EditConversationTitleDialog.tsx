/**
 * @fileoverview Edit-title dialog for a team chat (Unit 19).
 *
 * Captain-only. Opened from the conversation header's pencil affordance.
 * Pre-fills the current title; saves via `useUpdateConversationTitle`.
 * Validates client-side (trim + 80-char max + non-empty) before firing
 * the mutation. The mutation enforces the same rules server-side, plus
 * the permission gate (only the participant with `cannot_leave=true`
 * may rename) and the conversation-type gate (only `team_chat`).
 */

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CONVERSATION_TITLE_MAX_LENGTH,
  type UpdateConversationTitleParams,
} from '@/api/mutations/conversations';
import { useUpdateConversationTitle } from '@/api/hooks';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

interface EditConversationTitleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  userId: string;
  /** Current title — pre-fills the input. */
  initialTitle: string;
}

export function EditConversationTitleDialog({
  open,
  onOpenChange,
  conversationId,
  userId,
  initialTitle,
}: EditConversationTitleDialogProps) {
  const [value, setValue] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const mutation = useUpdateConversationTitle();

  // Reset the input to the current title whenever the dialog re-opens —
  // covers the case where the title was changed elsewhere or the user
  // bailed out of a previous edit.
  useEffect(() => {
    if (open) setValue(initialTitle);
  }, [open, initialTitle]);

  const trimmed = value.trim();
  const isValid =
    trimmed.length > 0 && trimmed.length <= CONVERSATION_TITLE_MAX_LENGTH;
  const isUnchanged = trimmed === initialTitle.trim();

  const handleSave = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      const params: UpdateConversationTitleParams = {
        conversationId,
        userId,
        title: trimmed,
      };
      await mutation.mutateAsync(params);
      onOpenChange(false);
    } catch (err) {
      logger.error('Failed to update conversation title', {
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error(
        err instanceof Error ? err.message : 'Could not rename this chat.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="edit-conversation-title-dialog"
      >
        <DialogHeader>
          <DialogTitle>Rename chat</DialogTitle>
          <DialogDescription>
            Give this team chat a custom name. Only you (the team captain)
            can rename it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="conversation-title-input">Chat name</Label>
          <Input
            id="conversation-title-input"
            data-testid="conversation-title-input"
            type="text"
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setValue(e.target.value)
            }
            maxLength={CONVERSATION_TITLE_MAX_LENGTH}
            disabled={saving}
            autoFocus
            placeholder="e.g. Sharks Family Reunion"
          />
          <p className="text-xs text-muted-foreground">
            {trimmed.length}/{CONVERSATION_TITLE_MAX_LENGTH}
          </p>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            loadingText="none"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            data-testid="edit-title-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            loadingText="none"
            disabled={!isValid || isUnchanged || saving}
            onClick={handleSave}
            data-testid="edit-title-save"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
