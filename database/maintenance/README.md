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
