/**
 * @fileoverview One conversation kind's notification default.
 *
 * On/off, plus — for group kinds only — how quiet that kind goes after it
 * notifies once. Direct messages get no interval control at all rather than a
 * permanently disabled one: a control that never becomes usable makes people
 * hunt for whatever unlocks it.
 *
 * Prop-driven, no data hooks, so each state renders in a test directly.
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
import { INTERVAL_PRESETS, type KindDisplay } from './notificationKinds';

interface KindPrefRowProps {
  kind: KindDisplay;
  pushEnabled: boolean;
  /** Minutes of quiet, or null for "every message". */
  intervalMinutes: number | null;
  disabled?: boolean;
  onChange: (pushEnabled: boolean, intervalMinutes: number | null) => void;
}

/** The Select needs a string; null (every message) is the empty sentinel. */
const toValue = (m: number | null) => (m === null ? 'every' : String(m));
const fromValue = (v: string) => (v === 'every' ? null : Number(v));

/**
 * Notification default for a single conversation kind.
 *
 * @param props - See {@link KindPrefRowProps}
 */
export function KindPrefRow({
  kind,
  pushEnabled,
  intervalMinutes,
  disabled = false,
  onChange,
}: KindPrefRowProps) {
  const switchId = useId();

  return (
    <div className="space-y-2 border-b py-3 last:border-b-0" data-testid={`kind-row-${kind.key}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label htmlFor={switchId} className="cursor-pointer">
            {kind.label}
          </Label>
          <p className="text-sm text-muted-foreground">{kind.hint}</p>
        </div>
        <Switch
          id={switchId}
          checked={pushEnabled}
          disabled={disabled}
          onCheckedChange={(next) => onChange(next, intervalMinutes)}
          aria-label={`${kind.label} notifications ${pushEnabled ? 'on' : 'off'}`}
          data-testid={`kind-switch-${kind.key}`}
        />
      </div>

      {/* Interval only for group kinds, and only while the kind is on — a
          timing choice under an off switch is noise. */}
      {kind.supportsInterval && pushEnabled && (
        <div className="pl-1">
          <Select
            value={toValue(intervalMinutes)}
            disabled={disabled}
            onValueChange={(v) => onChange(pushEnabled, fromValue(v))}
          >
            <SelectTrigger className="w-56" data-testid={`kind-interval-${kind.key}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVAL_PRESETS.map((p) => (
                <SelectItem key={toValue(p.value)} value={toValue(p.value)}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
