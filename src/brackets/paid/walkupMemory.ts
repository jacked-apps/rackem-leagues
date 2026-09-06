/**
 * @fileoverview Remember the name an accountless player typed (Unit C3).
 *
 * A walk-up has no account, so when they come back to the tournament page there
 * is nothing on the server that says who they are. This keeps a note in their
 * own browser, per tournament — a different tournament is a different key, so
 * last week's name never follows them to tonight's.
 *
 * It is a CONVENIENCE, never a source of truth. The page checks the remembered
 * name against the live list before believing it, because the organizer may
 * have removed them, and a note in one browser says nothing about the actual
 * tournament. Every access is wrapped: storage throws outright in some private
 * modes and can be disabled entirely.
 */

const PREFIX = 'bracket-walkup:';

/** Per-tournament so a name entered for one never appears on another. */
function key(joinToken: string): string {
  return `${PREFIX}${joinToken}`;
}

/** Note the name this browser used for this tournament. */
export function rememberWalkupName(joinToken: string, name: string): void {
  try {
    localStorage.setItem(key(joinToken), name);
  } catch {
    // Storage unavailable — they simply won't be recognised on return.
  }
}

/** The name this browser used for this tournament, if any. */
export function recallWalkupName(joinToken: string): string | null {
  try {
    return localStorage.getItem(key(joinToken));
  } catch {
    return null;
  }
}

/** Drop the note — used when the live list shows the name is no longer there. */
export function forgetWalkupName(joinToken: string): void {
  try {
    localStorage.removeItem(key(joinToken));
  } catch {
    // Nothing to do; a stale note is re-checked against the list every time.
  }
}
