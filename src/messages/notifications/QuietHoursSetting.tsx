/**
 * @fileoverview Quiet-hours control for the notification settings.
 *
 * One window, global to the member, applying to every conversation. Deliberately
 * NOT per-chat: quiet hours are a property of the person's day, not of any
 * conversation, and no chat can shout through them.
 *
 * Prop-driven (no data hooks) so every state is trivially renderable in a test,
 * matching `PushNotificationSetting` next to it.
 */

import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

/** Default window offered the first time it's switched on: 10pm to 7am. */
const DEFAULT_START = '22:00';
const DEFAULT_END = '07:00';

interface QuietHoursSettingProps {
  /** 'HH:MM' local wall-clock, or null when off. */
  start: string | null;
  end: string | null;
  disabled?: boolean;
  /** Called with both times, or both null to switch quiet hours off. */
  onChange: (start: string | null, end: string | null) => void;
}

/** Postgres hands back 'HH:MM:SS'; the time input wants 'HH:MM'. */
function toInputTime(value: string | null): string {
  return value ? value.slice(0, 5) : '';
}

/**
 * Quiet-hours on/off plus a start and end time.
 *
 * @param props - See {@link QuietHoursSettingProps}
 */
export function QuietHoursSetting({
  start,
  end,
  disabled = false,
  onChange,
}: QuietHoursSettingProps) {
  const switchId = useId();
  const startId = useId();
  const endId = useId();
  const isOn = !!start && !!end;

  // A window that wraps midnight is the expected shape (22:00 → 07:00), so say
  // so rather than letting it look like a mistake.
  const wrapsMidnight = isOn && start! > end!;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label htmlFor={switchId} className="cursor-pointer">
            Quiet hours
          </Label>
          <p className="text-sm text-muted-foreground">
            Nothing notifies during this window — no chat can override it.
          </p>
        </div>
        <Switch
          id={switchId}
          checked={isOn}
          disabled={disabled}
          onCheckedChange={(next) =>
            next ? onChange(DEFAULT_START, DEFAULT_END) : onChange(null, null)
          }
          aria-label={isOn ? 'Quiet hours on' : 'Quiet hours off'}
          data-testid="quiet-hours-switch"
        />
      </div>

      {isOn && (
        <div className="space-y-2 pl-1">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor={startId} className="text-xs text-muted-foreground">
                From
              </Label>
              <Input
                id={startId}
                type="time"
                className="w-32"
                value={toInputTime(start)}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value || null, end)}
                data-testid="quiet-hours-start"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={endId} className="text-xs text-muted-foreground">
                Until
              </Label>
              <Input
                id={endId}
                type="time"
                className="w-32"
                value={toInputTime(end)}
                disabled={disabled}
                onChange={(e) => onChange(start, e.target.value || null)}
                data-testid="quiet-hours-end"
              />
            </div>
          </div>
          {wrapsMidnight && (
            <p className="text-xs text-muted-foreground" data-testid="quiet-hours-overnight">
              Overnight — runs past midnight into the next morning.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
