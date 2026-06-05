/**
 * @fileoverview Pure derive for the per-game confirmer-audit line (LO match
 * review). For each side it reports the OFFICIAL confirmer (from the
 * `match_games.confirmed_by_*` column) plus the "+N others" who also vouched on
 * that side (from the append-only `game_confirmations` witness log).
 *
 * Sources, deliberately:
 *  - Official confirmer = the column (always present for a scored game, even for
 *    v1 LO-entered or pre-many-eyes games that have NO log rows).
 *  - "+N others" = `confirm` rows on that side, scoped to AFTER the latest vacate
 *    marker (so stale pre-correction vouches don't surface), excluding the
 *    operator (`loMemberId` — an operator correction is never an "other") and the
 *    per-side official id (it's already shown as the official).
 *
 * @see docs/plans/2026-06-04-001-feat-lo-match-review-correction-plan.md — Unit 4
 */

export type AuditSide = 'home' | 'away';

/** The `match_games` columns this derive reads (the official confirmers). */
export interface GameForAudit {
  confirmed_by_home: string | null;
  confirmed_by_away: string | null;
}

/** A `game_confirmations` row, narrowed to what the audit needs. */
export interface ConfirmationForAudit {
  confirmer_id: string;
  side: AuditSide;
  action: string; // 'confirm' | 'vacate'
  created_at: string;
}

/** A resolved confirmer for display. */
export interface ConfirmerName {
  id: string;
  name: string;
  team: string | null;
}

/** Per-side audit: the official confirmer (or null) + the extra vouchers. */
export interface SideAudit {
  official: ConfirmerName | null;
  others: ConfirmerName[];
}

export interface ConfirmerAudit {
  home: SideAudit;
  away: SideAudit;
}

/** Latest `created_at` among vacate markers (null if none). */
function latestVacateAt(confirmations: readonly ConfirmationForAudit[]): string | null {
  let latest: string | null = null;
  for (const c of confirmations) {
    if (c.action === 'vacate' && (latest === null || c.created_at > latest)) {
      latest = c.created_at;
    }
  }
  return latest;
}

function resolve(
  id: string,
  nameTeamById: ReadonlyMap<string, { name: string; team: string | null }>
): ConfirmerName {
  const hit = nameTeamById.get(id);
  return { id, name: hit?.name ?? id, team: hit?.team ?? null };
}

/**
 * Build the per-game confirmer-audit view model.
 *
 * @param game - the match_games row (official confirmer columns).
 * @param confirmations - this game's `game_confirmations` rows (any order).
 * @param nameTeamById - resolves a member id → display name + team.
 * @param loMemberId - the operator id, always excluded from "+N others".
 */
export function buildConfirmerAudit(
  game: GameForAudit,
  confirmations: readonly ConfirmationForAudit[],
  nameTeamById: ReadonlyMap<string, { name: string; team: string | null }>,
  loMemberId: string | null
): ConfirmerAudit {
  const vacatedAt = latestVacateAt(confirmations);

  const buildSide = (side: AuditSide): SideAudit => {
    const officialId = side === 'home' ? game.confirmed_by_home : game.confirmed_by_away;
    const official = officialId ? resolve(officialId, nameTeamById) : null;

    const seen = new Set<string>();
    const others: ConfirmerName[] = [];
    for (const c of confirmations) {
      if (c.side !== side || c.action !== 'confirm') continue;
      if (vacatedAt !== null && c.created_at <= vacatedAt) continue; // pre-correction
      if (c.confirmer_id === loMemberId) continue; // operator is never an "other"
      if (officialId && c.confirmer_id === officialId) continue; // already the official
      if (seen.has(c.confirmer_id)) continue;
      seen.add(c.confirmer_id);
      others.push(resolve(c.confirmer_id, nameTeamById));
    }
    return { official, others };
  };

  return { home: buildSide('home'), away: buildSide('away') };
}
