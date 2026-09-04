/**
 * @fileoverview Push notification setting (Unit 6).
 *
 * Presentational control for the Notifications section of the message settings
 * modal. Renders the right thing for each capability state:
 *   - supported          → an on/off Switch (checked = this device is subscribed)
 *   - needs-ios-install  → an "Add to Home Screen" explainer (no toggle)
 *   - denied             → a "blocked in settings" hint
 *   - unsupported        → a plain "not supported here" note
 *
 * Kept prop-driven (no hooks) so it's trivially testable across states; the
 * settings modal supplies the usePushSubscription values.
 *
 * See: docs/plans/2026-08-18-001-feat-message-push-notifications-plan.md (Unit 6)
 */

import { Bell } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { PushCapability } from '@/utils/push/pushCapability';

interface PushNotificationSettingProps {
  capability: PushCapability;
  isSubscribed: boolean;
  isBusy: boolean;
  onEnable: () => void;
  onDisable: () => void;
}

export function PushNotificationSetting({
  capability,
  isSubscribed,
  isBusy,
  onEnable,
  onDisable,
}: PushNotificationSettingProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Bell className="h-4 w-4" />
        Push notifications
      </div>

      <div className="p-3 bg-muted rounded-md space-y-3">
        {capability === 'supported' && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-sm font-medium text-foreground">
                  Notify me on this device
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Get a chime when someone messages you, even when the app is closed.
                </p>
              </div>
              <Switch
                checked={isSubscribed}
                disabled={isBusy}
                onCheckedChange={(next) => (next ? onEnable() : onDisable())}
                className="ml-3"
                data-testid="push-toggle"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Status:</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  isSubscribed ? 'bg-success/10 text-success' : 'bg-muted text-foreground'
                }`}
              >
                {isSubscribed ? 'On for this device' : 'Off'}
              </span>
            </div>
          </>
        )}

        {capability === 'needs-ios-install' && (
          <div
            className="p-2 bg-info/10 border border-info/40 rounded text-xs text-info"
            data-testid="push-ios-install"
          >
            <strong>Add to Home Screen first.</strong> On iPhone/iPad, notifications
            work only after you install the app: tap the Share button, choose
            "Add to Home Screen," then open Rack 'Em from your home screen and turn
            notifications on here.
          </div>
        )}

        {capability === 'denied' && (
          <div
            className="p-2 bg-info/10 border border-info/40 rounded text-xs text-info"
            data-testid="push-denied"
          >
            <strong>Notifications are blocked.</strong> Allow notifications for this
            site in your browser or device settings, then reload the page.
          </div>
        )}

        {capability === 'unsupported' && (
          <p className="text-xs text-muted-foreground" data-testid="push-unsupported">
            This browser doesn't support push notifications.
          </p>
        )}
      </div>
    </div>
  );
}
