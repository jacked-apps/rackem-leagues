/**
 * @fileoverview Edit-mode body for the scoring modal.
 *
 * When the LO taps the Edit button on the scoring modal (live-game inline
 * or office-page preview), the modal flips from score/preview mode to
 * 'edit' mode and renders THIS component as its body. The LO sees every
 * registry event applicable to the league's game type, with a Switch to
 * toggle visibility and a per-row Reset icon when the row has an explicit
 * override.
 *
 * State flow:
 *   - Local component state holds the user's accumulated toggles + which
 *     events have been Reset since the modal opened.
 *   - Save commits the delta (added/removed keys) to preferences via the
 *     parent's `onSave` handler. The parent owns the mutation.
 *   - Cancel discards local state and tells the parent to flip back to
 *     score/preview mode.
 *
 * The component is registry-driven: adding a new event in
 * `src/systems/game-events/definitions/` automatically surfaces it here.
 *
 * @see docs/plans/2026-05-09-001-feat-scoring-event-registry-plan.md (Unit 5 Phase 2)
 */

import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { listGameEvents, resolveEnabledEvents } from '@/systems/game-events';
import type { GameType } from '@/types/league';
import type { GameEventDefinition } from '@/systems/game-events/types';

interface ScoringDialogEditModeProps {
  /** Game type from the league preferences — drives which events apply. */
  gameType: GameType;
  /**
   * Current cascade-resolved override map (from useResolvedLeaguePrefs.enabled_events).
   * Sparse: present keys are explicit true/false; absent keys inherit from
   * the registry default at the resolver layer.
   */
  resolvedOverrides: Record<string, boolean>;
  /**
   * Called when the LO taps Save. Receives the FULL desired override map
   * for the scope being edited (league or org). Parent applies it via
   * `usePreferenceMutations.upsertPreference`. Resolves to indicate success.
   */
  onSave: (nextOverrides: Record<string, boolean>) => Promise<void>;
  /** Called when the LO taps Cancel. Parent flips mode back. */
  onCancel: () => void;
  /**
   * The mode the parent should flip back to on Save / Cancel — either
   * 'score' (LO was inline during a live match) or 'preview' (LO was in
   * the office preview card). The parent uses this to know which body to
   * re-render after the edit session closes.
   */
  returnMode: 'score' | 'preview';
}

export function ScoringDialogEditMode({
  gameType,
  resolvedOverrides,
  onSave,
  onCancel,
}: ScoringDialogEditModeProps) {
  // Local accumulator state. Initialised from the resolved overrides so
  // the user starts with what's currently set. Sparse: only keys with
  // explicit overrides are stored. "Reset" removes a key from this map.
  const [localOverrides, setLocalOverrides] = useState<Record<string, boolean>>(
    () => ({ ...resolvedOverrides }),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The set of events that apply to this game type — derived once from
  // the registry. Doesn't depend on the override state.
  const applicableEvents: GameEventDefinition[] = useMemo(
    () => listGameEvents().filter(e => e.gameTypes.includes(gameType)),
    [gameType],
  );

  // The default-enabled set for this game type (registry says it would
  // render with no overrides). Used to label the "currently inherited"
  // state on rows the LO hasn't explicitly overridden.
  const registryDefaults = useMemo(() => {
    return resolveEnabledEvents({}, gameType);
  }, [gameType]);

  // What the cascade currently resolves to (registry + caller's existing
  // resolvedOverrides). Used to label rows the LO inherits.
  const currentlyResolved = useMemo(
    () => resolveEnabledEvents(resolvedOverrides, gameType),
    [resolvedOverrides, gameType],
  );

  const handleToggle = (eventName: string, checked: boolean) => {
    setLocalOverrides(prev => ({ ...prev, [eventName]: checked }));
  };

  const handleReset = (eventName: string) => {
    setLocalOverrides(prev => {
      const next = { ...prev };
      delete next[eventName];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(localOverrides);
      // Parent flips mode after onSave resolves; no need to clear local state.
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Toggle which events scorers can record for this league. Changes
          apply when scorers open their next game modal.
        </p>
      </div>

      <div className="space-y-2 max-h-[55vh] overflow-y-auto">
        {applicableEvents.map(event => {
          const hasExplicitOverride = event.name in localOverrides;
          const effectiveValue = hasExplicitOverride
            ? localOverrides[event.name]
            : currentlyResolved.has(event.name);
          const inheritedValue = registryDefaults.has(event.name);

          return (
            <div
              key={event.name}
              className="flex items-start gap-3 rounded-md border border-border bg-card p-3"
            >
              <div className="flex-1 min-w-0">
                <Label
                  htmlFor={`event-switch-${event.name}`}
                  className="text-sm font-medium cursor-pointer"
                >
                  {event.label}
                  {event.abbreviation && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({event.abbreviation})
                    </span>
                  )}
                </Label>
                {event.winnerRequired && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Winner must be the {event.winnerRequired === 'breaker' ? 'breaker' : 'non-breaker'}
                  </p>
                )}
                {!hasExplicitOverride && (
                  <p className="text-xs text-muted-foreground mt-0.5 italic">
                    Inherited (default: {inheritedValue ? 'enabled' : 'disabled'})
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  id={`event-switch-${event.name}`}
                  checked={effectiveValue}
                  onCheckedChange={(checked) => handleToggle(event.name, checked)}
                  disabled={saving}
                  aria-label={`Toggle ${event.label}`}
                />
                {hasExplicitOverride && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleReset(event.name)}
                    disabled={saving}
                    aria-label={`Reset ${event.label} to default`}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {saveError && (
        <p className="text-sm text-destructive" role="alert">
          {saveError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          isLoading={saving}
          loadingText="Saving..."
        >
          Save
        </Button>
      </div>
    </div>
  );
}
