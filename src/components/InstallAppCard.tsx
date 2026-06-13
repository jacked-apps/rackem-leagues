/**
 * @fileoverview InstallAppCard — "add Rack 'Em to your home screen" entry point.
 *
 * A self-contained card (drop it anywhere — it owns all its state) that adapts
 * to the platform via {@link useInstallApp}:
 *   - Android / desktop Chrome where the native prompt was captured → an
 *     **Install app** button that fires the browser's install prompt.
 *   - iPhone/iPad (no install event exists) → an **Add to Home Screen** button
 *     that opens step-by-step Safari share-sheet instructions.
 *   - Android without a captured prompt → the same button with the Chrome-menu
 *     instructions, so Android users always have a path.
 *   - Already installed (standalone) or an unsupported desktop browser →
 *     renders nothing.
 *
 * Mirrors {@link ShareAppCard}'s shape so it sits naturally at the top of
 * Player Settings.
 */

import { useState } from 'react';
import { Download, Share, Smartphone } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useInstallApp } from '@/hooks/useInstallApp';

/** What the card should offer, derived from platform + native-prompt capability. */
type InstallMode = 'native' | 'ios' | 'android';

export function InstallAppCard() {
  const { isStandalone, canPromptInstall, platform, promptInstall } = useInstallApp();
  const [showInstructions, setShowInstructions] = useState(false);

  // Already installed → nothing to offer.
  if (isStandalone) return null;

  // Prefer the native prompt when we have one; otherwise fall back to manual
  // instructions for the touch platforms. Desktop browsers with no captured
  // prompt (Firefox/Safari) get nothing.
  const mode: InstallMode | null = canPromptInstall
    ? 'native'
    : platform === 'ios'
      ? 'ios'
      : platform === 'android'
        ? 'android'
        : null;

  if (!mode) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Install the app</CardTitle>
        <CardDescription>
          Add Rack &apos;Em to your home screen for one-tap access and a full-screen,
          app-like experience.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mode === 'native' ? (
          <Button onClick={promptInstall} loadingText="none" className="gap-2">
            <Download className="h-4 w-4" />
            Install app
          </Button>
        ) : (
          <Button
            onClick={() => setShowInstructions(true)}
            loadingText="none"
            className="gap-2"
          >
            <Smartphone className="h-4 w-4" />
            Add to Home Screen
          </Button>
        )}
      </CardContent>

      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent>
          {mode === 'ios' ? (
            <>
              <DialogHeader>
                <DialogTitle>Add Rack &apos;Em to your iPhone</DialogTitle>
                <DialogDescription>
                  Use <strong>Safari</strong> — other iPhone browsers can&apos;t add apps
                  to the home screen.
                </DialogDescription>
              </DialogHeader>
              <ol className="space-y-3 text-sm text-foreground">
                <li className="flex gap-3">
                  <Step n={1} />
                  <span>
                    Tap the <strong>Share</strong> button{' '}
                    <Share className="inline h-4 w-4 align-text-bottom" /> in Safari&apos;s
                    toolbar (bottom of the screen).
                  </span>
                </li>
                <li className="flex gap-3">
                  <Step n={2} />
                  <span>
                    Scroll down and tap <strong>Add to Home Screen</strong>.
                  </span>
                </li>
                <li className="flex gap-3">
                  <Step n={3} />
                  <span>
                    Tap <strong>Add</strong> in the top-right. The Rack &apos;Em icon
                    appears on your home screen.
                  </span>
                </li>
              </ol>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Add Rack &apos;Em to your phone</DialogTitle>
                <DialogDescription>
                  Install it from your browser&apos;s menu.
                </DialogDescription>
              </DialogHeader>
              <ol className="space-y-3 text-sm text-foreground">
                <li className="flex gap-3">
                  <Step n={1} />
                  <span>
                    Tap the menu <strong>⋮</strong> in the top-right of your browser.
                  </span>
                </li>
                <li className="flex gap-3">
                  <Step n={2} />
                  <span>
                    Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
                  </span>
                </li>
                <li className="flex gap-3">
                  <Step n={3} />
                  <span>Confirm — the Rack &apos;Em icon appears on your home screen.</span>
                </li>
              </ol>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** Numbered step bubble for the instruction lists. */
function Step({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
      {n}
    </span>
  );
}
