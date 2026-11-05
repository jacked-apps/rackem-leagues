/**
 * @fileoverview Per-conversation notification settings.
 *
 * The bottom of the veto chain: this chat can only ever be quieter than the
 * member's global rules, never louder. When a higher level already blocks it,
 * the dialog says which one and where to change it rather than presenting a
 * switch that appears to work and doesn't.
 *
 * Prop-driven; the container supplies data and handles saving.
 */

import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Modal } from '@/components/shared';
import { INTERVAL_PRESETS } from './notificationKinds';
import { effectiveInterval, type ChatOverride } from './resolveChatOverride';

interface ChatNotificationDialogProps {
  open: boolean;
  onClose: () => void;
  /** Conversation name, so the dialog says what it's acting on. */
  title: string;
  notify: boolean;
  intervalMinutes: number | null;
  /** False for a DM — no timing control at all, since DMs always buzz. */
  supportsInterval: boolean;
  override: ChatOverride;
  isSaving?: boolean;
  onChange: (notify: boolean, intervalMinutes: number | null) => void;
}

const toValue = (m: number | null) => (m === null ? 'every' : String(m));
const fromValue = (v: string) => (v === 'every' ? null : Number(v));

/**
 * Notification settings for a single conversation.
 *
 * @param props - See {@link ChatNotificationDialogProps}
 */
export function ChatNotificationDialog({
  open,
  onClose,
  title,
  notify,
  intervalMinutes,
  supportsInterval,
  override,
  isSaving = false,
  onChange,
}: ChatNotificationDialogProps) {
  const switchId = useId();
  if (!open) return null;

  const floor = override.kindIntervalMinutes;
  const effective = effectiveInterval(floor, intervalMinutes);

  // Only offer values that can actually take effect. Anything at or below the
  // kind's floor would resolve back to the floor via MAX, so showing it invites
  // a choice that visibly does nothing.
  const presets = INTERVAL_PRESETS.filter(
    (p) => floor === null || (p.value !== null && p.value > floor)
  );

  return (
    <Modal isOpen={open} onClose={onClose} title={`Notifications — ${title}`}>
      <Modal.Body className="space-y-4">
        {override.isOverruled && (
          <p
            className="rounded-md border border-border bg-muted p-2 text-sm text-muted-foreground"
            data-testid="chat-override-note"
          >
            {override.message}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <Label htmlFor={switchId} className="cursor-pointer">
              Notify me about this chat
            </Label>
            <p className="text-sm text-muted-foreground">
              {notify ? 'On' : 'Muted — messages still arrive, just silently'}
            </p>
          </div>
          <Switch
            id={switchId}
            checked={notify}
            disabled={isSaving}
            onCheckedChange={(next) => onChange(next, intervalMinutes)}
            aria-label={notify ? 'Notifications on for this chat' : 'This chat is muted'}
            data-testid="chat-notify-switch"
          />
        </div>

        {supportsInterval && notify && (
          <div className="space-y-1 border-t pt-3">
            <Label className="text-sm">Quiet for</Label>
            <Select
              value={toValue(intervalMinutes)}
              disabled={isSaving}
              onValueChange={(v) => onChange(notify, fromValue(v))}
            >
              <SelectTrigger className="w-full" data-testid="chat-interval">
                <SelectValue placeholder="Use my default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="every">Use my default</SelectItem>
                {presets.map((p) => (
                  <SelectItem key={toValue(p.value)} value={toValue(p.value)}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {floor !== null && (
              <p className="text-xs text-muted-foreground" data-testid="chat-interval-floor">
                Your default for this type is {floor} min — this chat can only be
                quieter. Currently {effective ?? 'every message'}
                {effective ? ' min' : ''}.
              </p>
            )}
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}
