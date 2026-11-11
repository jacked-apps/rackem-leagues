/**
 * @fileoverview The member's global notification rules, for the Settings modal.
 *
 * Sits below the device on/off switch and above everything per-chat:
 *
 *   master switch  →  QUIET HOURS + PER-KIND DEFAULTS (here)  →  per-chat
 *
 * Every level is a veto. Nothing here can make a member louder than their
 * master switch allows — only quieter. A per-chat setting, in turn, can only
 * add more silence on top of these.
 *
 * Only kinds that can actually push are listed: `push_type_policy` is the
 * system-level switch for whether a channel is live at all, and offering a
 * default for a channel that can't send would be a control that does nothing.
 *
 * @see docs/plans/2026-09-04-001-feat-notification-controls-plan.md
 */

import {
  useNotificationKindPrefs,
  usePushableKinds,
  useQuietHours,
  useSetNotificationKindPref,
  useSetQuietHours,
} from '@/api/hooks/useNotificationPrefs';
import { detectTimezone } from '@/api/mutations/notificationPrefs';
import { QuietHoursSetting } from './QuietHoursSetting';
import { KindPrefRow } from './KindPrefRow';
import {
  DEFAULT_GROUP_INTERVAL_MINUTES,
  KIND_DISPLAY,
  kindDisplay,
} from './notificationKinds';

interface NotificationPrefsSectionProps {
  memberId: string;
  /**
   * Whether this device is actually subscribed.
   *
   * These rules still save when it isn't — they're the member's settings, not
   * the device's — but they can't take effect, so say so instead of implying
   * they're doing something.
   */
  isSubscribed: boolean;
}

/**
 * Quiet hours + per-conversation-kind defaults.
 *
 * @param props - See {@link NotificationPrefsSectionProps}
 */
export function NotificationPrefsSection({
  memberId,
  isSubscribed,
}: NotificationPrefsSectionProps) {
  const { data: pushableKinds = [], isLoading: kindsLoading } = usePushableKinds();
  const { data: prefs = [], isLoading: prefsLoading } = useNotificationKindPrefs(memberId);
  const { data: quietHours, isLoading: quietLoading } = useQuietHours(memberId);

  const setKindPref = useSetNotificationKindPref();
  const setQuiet = useSetQuietHours();

  const isLoading = kindsLoading || prefsLoading || quietLoading;

  // Render in our declared order, not the DB's, so the list doesn't reshuffle
  // between visits. Direct messages first — it's the kind everyone has.
  const visibleKinds = KIND_DISPLAY.filter((k) => pushableKinds.includes(k.key));

  /**
   * The effective setting for a kind. No stored row means no restriction from
   * this level, which is how a member who has never opened Settings keeps
   * behaving exactly as before.
   */
  const settingFor = (key: string) => {
    const stored = prefs.find((p) => p.conversationKind === key);
    if (stored) return stored;
    const display = kindDisplay(key);
    return {
      conversationKind: key,
      pushEnabled: true,
      intervalMinutes: display?.supportsInterval
        ? DEFAULT_GROUP_INTERVAL_MINUTES
        : null,
    };
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading notification settings…</p>;
  }

  return (
    <div className="space-y-4">
      {!isSubscribed && (
        <p
          className="rounded-md border border-border bg-muted p-2 text-sm text-muted-foreground"
          data-testid="prefs-inactive-note"
        >
          These are saved to your account, but notifications are off for this
          device — turn them on above to start receiving them.
        </p>
      )}

      <QuietHoursSetting
        start={quietHours?.start ?? null}
        end={quietHours?.end ?? null}
        disabled={setQuiet.isPending}
        onChange={(start, end) =>
          setQuiet.mutate({
            memberId,
            start,
            end,
            // Captured, not asked for: "22:00" means nothing without knowing
            // whose clock, and the resolver treats a null zone as never-quiet
            // rather than guessing.
            timezone: start && end ? detectTimezone() : null,
          })
        }
      />

      {visibleKinds.length > 0 && (
        <div className="border-t pt-3">
          <h4 className="mb-1 text-sm font-semibold">By conversation type</h4>
          <p className="mb-2 text-sm text-muted-foreground">
            A single chat can be quieter than these, never louder.
          </p>
          {visibleKinds.map((kind) => {
            const setting = settingFor(kind.key);
            return (
              <KindPrefRow
                key={kind.key}
                kind={kind}
                pushEnabled={setting.pushEnabled}
                intervalMinutes={setting.intervalMinutes}
                disabled={setKindPref.isPending}
                onChange={(pushEnabled, intervalMinutes) =>
                  setKindPref.mutate({
                    memberId,
                    conversationKind: kind.key,
                    pushEnabled,
                    intervalMinutes,
                  })
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
