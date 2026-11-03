# Cheatsheet — commands and open work

Last updated 2026-09-16. Not auto-generated; ask Claude to refresh it.

---

## Compound-engineering commands

Plugin skills are namespaced, so the **long form always works**. The short form
works only on a machine where `~/.claude/commands/ce/` exists (see Setup below).

| What you want | Short | Long (always works) |
|---|---|---|
| Explore what to build | `/ce:brainstorm` | `/compound-engineering:ce-brainstorm` |
| Turn a brainstorm into a plan | `/ce:plan` | `/compound-engineering:ce-plan` |
| Execute planned work | `/ce:work` | `/compound-engineering:ce-work` |
| Review before a PR | `/ce:review` | `/compound-engineering:ce-review` |

Others, long form only:

- `/compound-engineering:ce-debug` — find a root cause, not a symptom
- `/compound-engineering:ce-compound` — write up a solved problem
- `/compound-engineering:git-commit` — commit with a real message
- `/compound-engineering:git-commit-push-pr` — commit, push, open a PR
- `/compound-engineering:document-review` — multi-persona review of a doc
- `/compound-engineering:resolve-pr-feedback` — work through PR review threads

**You never have to use a slash command.** "Brainstorm the game room host tiers"
in plain English gets you the same place.

## Built-in commands worth knowing

- `/code-review` — review the current diff or a PR number
- `/code-review ultra` — deep multi-agent cloud review of the branch
- `/artifacts` — list published artifacts (`o` opens, `c` copies link)
- `/config` — settings, model, fast mode
- `/tasks` — what background work is running
- `!<command>` — run a shell command yourself and drop the output into the chat

---

## Open PRs

All three are green as of 2026-09-16. Jack merges.

| PR | Branch | What it is |
|---|---|---|
| [#286](https://github.com/jacked-apps/rackem-leagues/pull/286) | `docs/member-designations` | Designations + org permissions brainstorm. **Docs only.** Ready to plan. |
| [#285](https://github.com/jacked-apps/rackem-leagues/pull/285) | `feat/team-name-roster-popover` | Tap a team name anywhere to see who's on it |
| [#284](https://github.com/jacked-apps/rackem-leagues/pull/284) | `fix/late-entry-hopper-lockout` | A late entrant was locked out of their own tournament page |

⚠️ #284 and #285 both add lines to `src/whatsNew/releases.ts`. Whichever merges
second hits a small conflict there. Normal, two-line fix.

## Active branches (no PR yet)

| Branch | State |
|---|---|
| `feat/self-scoring-individual-races` | Race schema, engine, room + 51 tests, all green. Blocked only on the game room. Read `docs/plans/2026-09-10-self-scoring-resume-here.md` first. |
| `feat/game-room` | Game-room brainstorm. Being built on the other computer. |
| `feat/tournament-paid-foundation` | Long-running; 71 commits off main. Check before assuming it's current. |

---

## Next action

Plan Phase 1 of the roles work:

```
/compound-engineering:ce-plan docs/brainstorms/2026-09-16-member-designations-requirements.md — Phase 1 only
```

**Say "Phase 1 only."** The doc designs two phases deliberately; Phase 2 (expiry
and billing) must not be built until something is actually sold, because today
nothing in the system can expire.

---

## Every PR needs a What's New answer

CI fails otherwise. Two ways to pass, neither better than the other:

1. **Add a line** to the `unreleased` block in `src/whatsNew/releases.ts`
   — written for a pool player, zero jargon, one or two sentences.
2. **Put `[no-changelog]`** in the PR description — correct for refactors, test
   fixes, dependency bumps, docs-only PRs.

Editing the description is enough to clear the check; no dummy commit needed.

---

## Updating Claude Code

Auto-update fails while Claude Code is running — it can't replace files it is
using. Windows says so outright ("claude.exe in use"); macOS just says "auto
update failed". Same cause.

1. Close **every** session, on both computers
2. `npm i -g @anthropic-ai/claude-code`
3. Reopen, confirm with `claude --version`
4. `claude doctor` if it still fails

## Setup on a second machine

The `/ce:` shortcuts live in `~/.claude/commands/ce/` and do **not** travel with
the repo. On a new machine either recreate them, or move them into the repo at
`.claude/commands/ce/` so git carries them to both.

---

## Standing rules

- Never commit to `main` — always a branch
- `pnpm`, never `npm`, for project dependencies
- Schema truth is `supabase/migrations/` — **`database/schema_dump.sql` is stale**
- New migrations: real UTC timestamp, `supabase migration new <name>`
- Prefer `supabase migration up` over `db reset` — reset wipes local test data
- Update `TABLE_OF_CONTENTS.md` when adding, moving or deleting any file
