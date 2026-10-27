# Database Maintenance Scripts

Developer-only, hand-run SQL for rare data-surgery tasks that must **not** be
self-serve features in the app.

## Rules

- **Not deployed.** These files are never wired into the UI, an edge function,
  or a migration. They run only when a developer pastes them into the Supabase
  SQL editor (or `psql`) against the target database. That is the whole point —
  the access requirement *is* the guard.
- **Transactional + reversible where possible.** Prefer reusing existing,
  tested RPCs (which already write archive/audit rows) over hand-written
  `UPDATE`s. Wrap work in a single transaction so a failure rolls everything
  back.
- **Preview before mutate.** Each script should offer a read-only STEP 1 that
  shows exactly what will change, before any STEP 2 that changes it.

## Scripts

| File | What it does |
|------|--------------|
| `mergeRegisteredPlayers.sql` | Merge two **real registered accounts** that belong to the same person (e.g. a duplicate signup where both logins have since played matches). The in-app placeholder merge refuses this on purpose; this script reuses the same `merge_placeholder_into_member_v2` RPC by first demoting the discard account to a placeholder, so the merge stays undoable via `lo-undo-merge`. Read its header for the 3-step procedure. |
| `diagnose_standings_points.sql` | **Read-only** diagnostic. For one season, lists every completed match with stored vs expected points (rule applied to the saved targets + confirmed games), flags mismatches, and totals stored vs expected per team. Changes nothing. |
| `recalculate_points_3man_1_preview.sql` | **Step 1 of 3, read-only.** Previews the re-score of stored points on completed Points 3-Man (games-mode) matches against their **saved** targets, fixing matches mis-scored before the saved-targets engine fix (e.g. a match win stored at −1). Lists `will_update` (old → new) and `needs_review` (stored games disagree with `match_games`, left alone). |
| `recalculate_points_3man_2_apply.sql` | **Step 2 of 3.** One transaction: backs up old values to `maintenance.points_recalc_backup`, then updates only `*_points_earned`. Set the same season as the preview. |
| `recalculate_points_3man_3_undo.sql` | **Step 3 of 3, only if needed.** Restores the most recent apply run from the backup. |
