# Rackem Leagues — project guidance for Claude

## Memory Bank

Project notes live in `memory-bank/`. When the user says **update memory bank**,
review every file in it — not just the ones that look stale.

## User Preferences

- **Best Practices Over Convenience**: When the user asks for something that conflicts with software engineering best practices, I should push back respectfully and explain the best practice approach. Provide clear reasoning with pros/cons, real-world examples, and performance implications. The user wants to learn and make informed decisions, not receive "yes man" responses. In the end, the user has final say, but they always want to know the correct way to do something first. **The user is learning and wants to be taught, not blindly agreed with.**

- **shadcn/ui Component Usage**: **CRITICAL - USE SHADCN COMPONENTS FOR EVERYTHING.** Always use shadcn/ui components for ALL UI elements to maintain consistency throughout the application. This includes:
  - `Button` from `@/components/ui/button` for ALL buttons (never use `<button>` elements)
  - `Input` from `@/components/ui/input` for ALL text inputs (never use `<input>` elements)
  - `Label` from `@/components/ui/label` for ALL form labels (never use `<label>` elements)
  - `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` from `@/components/ui/select` for ALL dropdowns (never use `<select>` elements)
  - `Card`, `CardHeader`, `CardTitle`, `CardContent` from `@/components/ui/card` for card layouts
  - Other shadcn components as appropriate
  - Start with bare bones shadcn components first, without adding custom styles or classes
  - Discuss styling additions after the basic functionality is working
  - This ensures consistent design system usage across the entire application

- **Git Workflow Reminders**: User often forgets to commit and push at regular intervals. Proactively remind user to commit and push after successful checkpoints, feature completions, or when significant progress has been made. Ask "Should we commit these changes?" when appropriate.

- **Task Scope Management**: Take smaller bites of tasks. Focus ONLY on what is specifically requested without expanding scope. Always ask before adding features or improvements beyond the original request. Break complex tasks into individual steps and complete one at a time.

- **Component-First Development**: Always check existing reusable components first before writing new code. Default to creating reusable components rather than inline code. Break all complex features into small, testable, reusable pieces. Regularly scan existing components to see if they can be used, enhanced, or adapted for new features.

- **Package Manager**: This project uses **pnpm** (not npm). Always use pnpm commands for package management, installations, and dependency operations.

- **Dev Server Management**: When restarting the dev server, kill the existing process but then ask the user to manually run `pnpm run dev` in their terminal rather than running it automatically. The background execution doesn't always start a new instance properly for the user.

- **Database Operations**: This project uses a local Supabase instance for development. When creating database schema changes, provide SQL migration files in the `/database` folder with complete documentation. The user and their partner will run these SQL files on their local Supabase instance to create/modify tables. For UI components, implement full database operations using the Supabase client (`@/supabaseClient`). The user's partner will mirror these database calls for the mobile app, but the web app should have complete, working database functionality. Most operator/management features are web-only and won't be needed in the mobile app (which focuses on scorekeeping).

- **Code Display in Chat**: NEVER show code blocks in chat responses unless explicitly requested by the user. Describe what changes are being made or what the plan is, but do not paste code snippets into the conversation. Code should only appear in file edits via tools, not in chat messages.

- **Date Input Component**: ALWAYS use the `Calendar` component from `@/components/ui/calendar` for all date inputs. Never use plain `<input type="date">` elements. The Calendar component provides a clickable calendar icon that opens a visual date picker popup, which is the required UX pattern for this project.

- **Timezone-Safe Date Handling**: ALWAYS use the date utility functions from `@/utils/formatters` when working with dates:
  - `parseLocalDate(isoDate)` - Convert ISO string to Date object in local timezone (prevents off-by-one day errors)
  - `formatLocalDate(date)` - Convert Date object to ISO string in local timezone
  - `getDayOfWeek(isoDate)` - Get day number (0-6) from ISO string
  - `getDayOfWeekName(isoDate)` - Get day name from ISO string
  - NEVER use `new Date('2024-01-15')` directly - it uses UTC which causes timezone bugs
  - NEVER use `date.toISOString().split('T')[0]` - use `formatLocalDate()` instead

The format is flexible - focus on capturing valuable insights that help me work more effectively with you and the project. Think of memory-bank folder as a living document that grows smarter as we work together.

## Claude Code Specific Features

### Table of Contents Maintenance
**CRITICAL**: The project has a comprehensive `TABLE_OF_CONTENTS.md` file at the project root that indexes EVERY file in the project.

**You MUST update this file whenever you:**
- Create any new file or folder
- Move or rename any file or folder
- Delete any file or folder

**Update process:**
1. Add/update/remove the file entry in the appropriate section
2. Update the "Last Updated" date at the top of TABLE_OF_CONTENTS.md
3. If the change affects a feature, update the "Quick Reference: Find By Feature" section

The table of contents is a critical navigation tool for both you and the user. Keeping it current is mandatory.

### Committing
- Never commit changes unless explicitly asked.

### Feature Gating Workflow
Some features ship **gated** — merged to `main` but NOT yet live for users
(e.g. a `!isProduction` route guard, or a feature flag that's off in
production). This lets finished code integrate into main without exposing an
unverified flow to real users; Ed reviews it on **staging** (where non-prod
gates are open) and then says when to un-gate. This is the standard, expected
path — not a workaround.

**A gate MUST cover every entry point, not just the route.** If a feature is
gated (e.g. a `!isProduction` route) but the **button / link / card / icon**
that navigates to it is NOT gated the same way, production shows the door but
the room is gone → click → "No routes matched" / ErrorBoundary. Gate the route
AND every door into it with the SAME condition (or hide the doors entirely).
When un-gating, flip ALL of them together. (This bit us 2026-06-21: the "Score
a Match" button + lms-sheet printer icon were ungated while their routes were
`!isProduction`, so they 404'd in production.)

When I gate a feature (or a newly-merged gated feature lands):
1. **Add it to `LIST_FOR_ED.md`** under the "🚪 Gated — awaiting staging review
   + un-gate" section: feature name, where the gate lives (file + the
   flag/conditional **and every entry point gated**), and one line on what Ed
   should verify on staging.
2. **Tell Ed in chat** that it's gated, so he knows to review it on staging.
3. Ed reviews on staging → tells me to un-gate.
4. **On un-gate:** flip the conditional/flag (route **and all entry points**) to
   expose it in production, AND **remove its entry from `LIST_FOR_ED.md`**.

So the gated section of `LIST_FOR_ED.md` is always the live list of "built +
merged but not yet turned on for users." (Per the notes-files rule, these edits
ride with the related working commit.)

### Pre-approved Commands
The following commands can be run without explicit user permission:
- `pnpm run build` (includes TypeScript compilation/typecheck)
- `pnpm run typecheck` (TypeScript type checking)
- `pnpm run lint` (code quality checks)
- Any read-only analysis commands (grep, glob, read files)

### Migration Filenames — use a REAL timestamp
**Every new file in `supabase/migrations/` gets a true UTC timestamp down to
the second** — `YYYYMMDDHHMMSS`, e.g. `20260904154852_add_thing.sql`. Prefer
`supabase migration new <name>`, which stamps it correctly. Writing one by
hand? Use the actual current UTC time.

**Never** use the legacy all-zeros form (`20260904000000`) that most existing
files carry. That convention zeroes the time half and relies on someone
hand-bumping a counter (`...000000`, `...000001`, `...000002`) for same-day
files — which fails the moment two migrations are authored on the same day on
**different branches**, because neither branch can see the other's file.

The resulting collision is invisible until it hits a live database:

- Git merges both cleanly — the *filenames* differ, so there's no conflict.
- Nothing in review or CI compares version numbers.
- Postgres is the first thing that actually compares them, because
  `supabase_migrations.schema_migrations` is keyed on **version alone**,
  ignoring the name. The second migration dies with
  `duplicate key value violates unique constraint "schema_migrations_pkey"`.
- The migration step runs **before** the S3 upload in the deploy workflows, so
  the whole deploy aborts and the environment silently keeps serving the old
  bundle.

This cost 8 days of dead staging in Sept 2026 (`20260818000000` was used twice)
and made a fully-built, merged feature look like it had never been written.

**Before committing a migration,** confirm this comes back empty:

```
ls supabase/migrations | sed 's/_.*//' | sort | uniq -d
```

If a collision is already merged, renumber the file that has **never been
applied in any environment** (verify against the live DB first — never renumber
one whose version is already recorded in `schema_migrations`). Renumber *down*
when later migrations depend on it, so dependent files keep their order and
don't need touching.

### Testing Conventions
**Where you put a test file determines how vitest schedules it.** The
`vitest.config.ts` has two projects (`unit` + `db`) that auto-route
files by path. Full conventions live in `src/__tests__/README.md`;
the rule that matters most for new code:

- **If your test touches the real local Postgres** (raw SQL via
  `executeSql`, supabase-js writes hitting `localhost:54322`, migration
  verification, trigger/RLS tests) → put it under
  `src/__tests__/database/`. The `db` project runs these
  **sequentially** with jsdom so they don't race each other on the
  shared DB. Add `// @vitest-environment jsdom` as the first line if
  the file uses supabase-js write paths (see
  `memory/project_happy_dom_supabase_insert_limit.md`).
- **Every other test** (component, hook, utility, integration with
  mocked supabase-js) → co-locate with the source file as
  `Foo.test.tsx` OR put under `src/__tests__/unit/` or
  `src/__tests__/integration/`. The `unit` project runs these in
  parallel with happy-dom.

Plain `pnpm test:run` does the right thing for both projects — no
`--no-file-parallelism` flag, no manual orchestration. CI workflows
that call `pnpm test:run` inherit the behavior automatically. Don't
add tests outside the two project paths without first updating the
`include` arrays in `vitest.config.ts`.

### Code Documentation Standards
This is a collaborative project requiring comprehensive code documentation:

**File Headers:**
- Every file must have `@fileoverview` explaining its purpose and role
- Include context about how the file fits into the larger system

**JSDoc Comments:**
- All functions, hooks, and utilities need detailed documentation
- Include `@param` and `@returns` documentation
- Provide usage examples for complex functions
- Document expected input/output formats

**Inline Comments:**
- Explain complex logic and business rules step-by-step
- Document the "why" behind decisions, not just the "what"
- Include context about user flows and system behavior
- Explain error handling reasoning and edge cases

**Component Documentation:**
- Document props interfaces with clear descriptions
- Explain state management patterns and data flow
- Document component responsibilities and usage patterns
- Include examples of expected usage

**Comment Style Guidelines:**
- Be informative without being verbose
- Focus on business context and user impact
- Include practical examples where helpful
- Document TODOs for future features clearly
- Explain integration points with external systems (Supabase, etc.)

REMEMBER: I maintain context throughout our conversation session and can directly analyze your codebase. The Memory Bank enhances this by providing project-specific context, patterns, and ongoing work status.

# Planning

When asked to enter "Planner Mode" or using planning approaches, I deeply reflect upon the changes being asked and analyze existing code to map the full scope of changes needed. Before proposing a plan, I ask 4-6 clarifying questions based on my findings. Once answered, I draft a comprehensive plan of action and ask for approval. Once approved, I implement all steps using the TodoWrite tool to track progress. After completing each phase/step, I mention what was just completed and what the next steps are.