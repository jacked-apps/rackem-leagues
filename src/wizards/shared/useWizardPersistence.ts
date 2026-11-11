/**
 * @fileoverview useWizardPersistence — localStorage scratch persistence
 *
 * Tier 2 persistence per the wizard 2.0 plan: stores in-progress wizard
 * state (form data + current step ID) in localStorage so a browser
 * refresh doesn't lose the user's typing.
 *
 * - Debounced saves (300ms) to avoid hammering localStorage on every keystroke
 * - Schema version tag — stale data is discarded on version mismatch
 * - Stores currentStepId (string) not currentStepIndex so adding/removing
 *   steps doesn't break in-progress wizards
 *
 * NOTE: This is browser-local scratch only. Real database commits happen
 * in Phase 9 (Dual-Write Mutation).
 */

import { useEffect, useRef, useCallback } from 'react';

interface PersistedPayload<TFormData> {
  version: number;
  currentStepId: string;
  formData: TFormData;
  savedAt: number;
}

interface UseWizardPersistenceArgs<TFormData> {
  /** Whether persistence is enabled. When false, the hook is a no-op. */
  enabled: boolean;
  /** Storage key (e.g., wizard-v2:standalone:league:formData) */
  storageKey: string;
  /** Schema version — bump to invalidate stale data */
  version: number;
  /** Current form data (re-saved on change) */
  formData: TFormData;
  /** Current step ID (re-saved on change) */
  currentStepId: string;
  /** Debounce window in milliseconds */
  debounceMs?: number;
}

/**
 * Read once on mount to retrieve any previously-persisted state.
 * Used by WizardShell to seed initial state from storage if present.
 */
export function readPersistedWizardState<TFormData>(
  storageKey: string,
  version: number,
): PersistedPayload<TFormData> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPayload<TFormData>;
    if (parsed.version !== version) {
      // Schema mismatch — discard stale data
      window.localStorage.removeItem(storageKey);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Hook that debounces saves of wizard state to localStorage.
 * Call from WizardShell whenever formData or currentStepId changes.
 */
export function useWizardPersistence<TFormData>({
  enabled,
  storageKey,
  version,
  formData,
  currentStepId,
  debounceMs = 300,
}: UseWizardPersistenceArgs<TFormData>) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      try {
        const payload: PersistedPayload<TFormData> = {
          version,
          currentStepId,
          formData,
          savedAt: Date.now(),
        };
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch {
        // Storage full or unavailable — silent fail (scratch is best-effort)
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled, storageKey, version, currentStepId, formData, debounceMs]);

  /** Manually clear the persisted state (e.g., after wizard completes or cancels) */
  const clear = useCallback(() => {
    if (!enabled) return;
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Silent fail
    }
  }, [enabled, storageKey]);

  return { clear };
}
