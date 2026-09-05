/**
 * @fileoverview Local form state for the create-bracket flow (Unit 4).
 *
 * A small, self-contained state hook (no persistence — brackets are ephemeral,
 * so unlike the league wizard there's nothing to resume). Holds the three
 * steps' fields, participant list editing (add / remove / reorder), and derived
 * validation. Kept UI-free so the orchestrator + steps stay thin.
 */

import { useState, useCallback, useMemo } from 'react';
import type { BracketFormat, SeedingMode } from '@/types/bracket';

/** The three linear steps of the create flow. */
export type CreateStep = 'details' | 'participants' | 'review';

export interface CreateBracketFormState {
  step: CreateStep;
  name: string;
  format: BracketFormat;
  grandFinalReset: boolean;
  seedingMode: SeedingMode;
  /** Ordered participant display names (order = seed order for seeded mode). */
  participants: string[];
}

/** Free-tier v1 field cap (see plan): bounds the bracket + layout. */
export const MAX_PARTICIPANTS = 64;
export const MIN_PARTICIPANTS = 2;

const INITIAL: CreateBracketFormState = {
  step: 'details',
  name: '',
  format: 'double_elimination',
  // Default ON — the "true" double-elim finals (the unbeaten finalist can't be
  // knocked out on a single loss). Only surfaces for double elimination.
  grandFinalReset: true,
  seedingMode: 'seeded',
  participants: [],
};

export function useCreateBracketForm() {
  const [state, setState] = useState<CreateBracketFormState>(INITIAL);

  const set = useCallback(
    <K extends keyof CreateBracketFormState>(key: K, value: CreateBracketFormState[K]) =>
      setState((s) => ({ ...s, [key]: value })),
    []
  );

  const addParticipant = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState((s) =>
      s.participants.length >= MAX_PARTICIPANTS
        ? s
        : { ...s, participants: [...s.participants, trimmed] }
    );
  }, []);

  const removeParticipant = useCallback((index: number) => {
    setState((s) => ({
      ...s,
      participants: s.participants.filter((_, i) => i !== index),
    }));
  }, []);

  /** Move a participant up (dir -1) or down (dir +1) — mobile-safe reorder. */
  const moveParticipant = useCallback((index: number, dir: -1 | 1) => {
    setState((s) => {
      const target = index + dir;
      if (target < 0 || target >= s.participants.length) return s;
      const next = [...s.participants];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...s, participants: next };
    });
  }, []);

  const goTo = useCallback((step: CreateStep) => set('step', step), [set]);

  /** Whether the current step is complete enough to advance / submit. */
  const validation = useMemo(() => {
    const nameOk = state.name.trim().length > 0;
    const countOk =
      state.participants.length >= MIN_PARTICIPANTS &&
      state.participants.length <= MAX_PARTICIPANTS;
    // Duplicate names are allowed (free text) but worth a soft warning.
    const hasDuplicates =
      new Set(state.participants.map((p) => p.toLowerCase())).size !==
      state.participants.length;
    return { nameOk, countOk, hasDuplicates, canSubmit: nameOk && countOk };
  }, [state.name, state.participants]);

  return {
    state,
    set,
    addParticipant,
    removeParticipant,
    moveParticipant,
    goTo,
    validation,
  };
}
