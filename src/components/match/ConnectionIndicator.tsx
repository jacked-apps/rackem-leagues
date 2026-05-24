/**
 * @fileoverview Calm connection indicator for the active scorer
 * (live-scoring resilience, Phase 1 / Unit 4).
 *
 * The north star is *invisible robustness*: it should look like nothing is
 * ever wrong. So this indicator is deliberately the least-alarming thing that
 * still tells the scorer what's happening:
 *
 *   - `live`          → render nothing. No dot, no chrome — silence is calm.
 *   - `realtime-down` → a quiet "Catching up…" pill. Scoring is still flowing
 *                       (the polling fallback keeps it in sync), so this is a
 *                       muted reassurance, never a red alarm.
 *   - `offline` (brief) → the same quiet pill. A short blip should never look
 *                       scary.
 *   - `offline` (sustained, past a threshold) → a single calm note reassuring
 *                       the scorer that their scores are safe and will sync.
 *
 * Watchers/spectators don't mount this — they see the board quietly catch up.
 */

import { useEffect, useState } from 'react';
import { Loader2, WifiOff } from 'lucide-react';
import type { ConnectionHealth } from '@/realtime/useConnectionHealth';

/**
 * How long the device must be continuously `offline` before we upgrade the
 * quiet pill to a single calm note. Short blips never reach this.
 */
const DEFAULT_SUSTAINED_OUTAGE_MS = 8000;

interface ConnectionIndicatorProps {
  /** Connection health from `useConnectionHealth`. */
  health: ConnectionHealth;
  /** Override the sustained-outage threshold (primarily for tests). */
  sustainedOutageMs?: number;
}

/**
 * Render the calmest feedback appropriate to the current connection health.
 * Returns `null` when healthy so the scoring screen shows no chrome at all.
 */
export function ConnectionIndicator({
  health,
  sustainedOutageMs = DEFAULT_SUSTAINED_OUTAGE_MS,
}: ConnectionIndicatorProps) {
  // Whether the device has been offline long enough to warrant the calm note.
  const [sustained, setSustained] = useState(false);

  useEffect(() => {
    // Only an *offline* state escalates. Any non-offline health resets the
    // escalation so a recovered/realtime-down connection never shows the note.
    if (health !== 'offline') {
      setSustained(false);
      return;
    }
    const timer = setTimeout(() => setSustained(true), sustainedOutageMs);
    return () => clearTimeout(timer);
  }, [health, sustainedOutageMs]);

  // Healthy → show nothing.
  if (health === 'live') return null;

  // Sustained outage → one calm, reassuring note (not an alarm).
  if (health === 'offline' && sustained) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700"
      >
        <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Trouble connecting — your scores are safe and will sync automatically.</span>
      </div>
    );
  }

  // realtime-down, or a brief offline blip → an unobtrusive "catching up" pill.
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
      <span>Catching up…</span>
    </div>
  );
}
