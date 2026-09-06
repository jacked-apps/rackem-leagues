/**
 * @fileoverview PWA Update Prompt Component
 *
 * Displays a prompt to users when a new version of the app is available.
 * Uses the vite-plugin-pwa's useRegisterSW hook to detect and apply updates.
 * The prompt appears as a toast-like notification at the bottom of the screen.
 *
 * This is the mechanism every future fix reaches users through, so it has to be
 * both honest (pressing the button visibly does something) and reliable (it
 * actually lands on the new build). Both of those needed fixing — see
 * `handleUpdate` for why the reload can't be left to the service worker alone.
 */

import { useState, useRef, useEffect, useId } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  getWhatsNewPreference,
  requestWhatsNewAfterUpdate,
  setWhatsNewPreference,
} from '@/whatsNew/useShowWhatsNewAfterUpdate';
import { logger } from '@/utils/logger';

/**
 * How long to wait for the new service worker to take control before reloading
 * the page ourselves.
 *
 * `updateServiceWorker(true)` posts SKIP_WAITING and then waits for a
 * `controllerchange` event to reload. That event never fires if there is no
 * worker actually in `waiting` at that moment — a race with registration, a
 * worker that already activated, or a tab that was backgrounded while the
 * update was detected. In those cases the old code just sat there looking
 * broken. Long enough that a normal activation wins the race and this never
 * runs; short enough that a stuck update doesn't feel ignored.
 */
const UPDATE_RELOAD_TIMEOUT_MS = 3000;

/**
 * PWAUpdatePrompt Component
 *
 * Handles service worker registration and displays an update prompt
 * when a new version of the app is available. Users can choose to
 * update immediately or dismiss the prompt.
 *
 * @returns The update prompt UI or null if no update is available
 */
export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      logger.info('Service worker registered', {
        scope: registration?.scope,
      });
    },
    onRegisterError(error) {
      // Previously a console.log, so a registration failure was invisible to
      // us and to the user. If this fires, the app cannot receive updates at
      // all, which is worth being able to see in the logs.
      logger.error('Service worker registration failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [showNotes, setShowNotes] = useState(getWhatsNewPreference);
  const notesCheckboxId = useId();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The reload usually tears this component down, but not on the paths where
  // it doesn't — don't leave a timer running into an unmounted component.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  /**
   * Apply the waiting update.
   *
   * Two things go wrong if you just call `updateServiceWorker(true)` in an
   * onClick and walk away, and both were happening:
   *
   * 1. Nothing appears to happen. `updateServiceWorker` returns a promise, but
   *    the Button needs an explicit `isLoading` — it can't observe a promise on
   *    its own. Pressing the button gave no spinner, no disabled state, no
   *    acknowledgement, so it read as ignored and people pressed it again.
   * 2. Sometimes it never updates. The reload is driven by `controllerchange`,
   *    which doesn't fire when there is no worker in `waiting` (see
   *    UPDATE_RELOAD_TIMEOUT_MS). Then the prompt just sits there.
   *
   * So: show the in-flight state, and guarantee the reload ourselves rather
   * than trusting an event that may never arrive.
   */
  const handleUpdate = async () => {
    setIsUpdating(true);

    // Remember the answer so someone who doesn't care isn't asked every
    // release, and hand the intent to sessionStorage — the reload below wipes
    // React state, so this is the only way it survives.
    setWhatsNewPreference(showNotes);
    if (showNotes) requestWhatsNewAfterUpdate();

    // Whatever happens below, land on the new build. If the service worker
    // takes control normally it reloads first and this never runs.
    timeoutRef.current = setTimeout(() => {
      window.location.reload();
    }, UPDATE_RELOAD_TIMEOUT_MS);

    try {
      await updateServiceWorker(true);
    } catch (error) {
      logger.error('Service worker update failed; forcing reload', {
        error: error instanceof Error ? error.message : String(error),
      });
      window.location.reload();
    }
  };

  /**
   * Closes the update prompt without applying the update
   */
  const close = () => {
    setNeedRefresh(false);
  };

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg bg-card border border-border p-4 shadow-lg">
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="font-semibold text-foreground">Update Available</h3>
          <p className="text-sm text-muted-foreground">
            A new version of Rackem Leagues is available. Reload to update.
          </p>
        </div>
        {/* Ticked by default: the notes are the point of updating, and most
            people haven't formed an opinion. Unticking sticks, so anyone who
            doesn't care is asked once rather than every release. */}
        <div className="flex items-center gap-2">
          <Checkbox
            id={notesCheckboxId}
            checked={showNotes}
            disabled={isUpdating}
            onCheckedChange={(checked) => setShowNotes(checked === true)}
            data-testid="show-whats-new"
          />
          <Label
            htmlFor={notesCheckboxId}
            className="cursor-pointer text-sm font-normal text-muted-foreground"
          >
            Show me what&apos;s new
          </Label>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={close} disabled={isUpdating}>
            Later
          </Button>
          <Button
            size="sm"
            onClick={handleUpdate}
            isLoading={isUpdating}
            loadingText="Updating..."
          >
            Update Now
          </Button>
        </div>
      </div>
    </div>
  );
}
