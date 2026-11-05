---
summary: Move to Supabase CLI v3 on purpose (config.toml, CI and both deploys together)
kind: task
added: 2026-11-05
checked: 2026-11-05
---

On 2026-11-05 Supabase CLI v3.0.0 came out. The staging deploy used
`version: latest`, picked it up, and died in `supabase db push` with
"[inbucket] in supabase/config.toml is no longer supported. Use [local_smtp]
instead." The deploy stops before the S3 upload, so staging kept the old app.

Fix for now: both deploy workflows are pinned to 2.117.0, the same version
`.github/workflows/checks.yml` already pins.

To upgrade, do it in one PR:
- Rename `[inbucket]` to `[local_smtp]` in `supabase/config.toml` and check
  the other v3 config changes.
- Bump the pin in `checks.yml`, `deploy-staging.yml` and
  `deploy-production.yml` together.
- Ed and Jack update their local CLI first (Ed's is 2.51.0), since an old CLI
  won't read the new config key.
