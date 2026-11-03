# What's New notes waiting to ship

One file per user-facing PR. Name it after the branch, with `/` swapped for
`-`. For example, `fix/new-message-hide-blocked` becomes
`fix-new-message-hide-blocked.json`.

```json
{
  "text": "Blocking someone from Messages didn't work — the block was refused every time. It works now.",
  "kind": "fix",
  "headline": "blocking in Messages"
}
```

- `text` (required) is what a pool player reads. Follow the writing rules in
  the header of `../releases.ts`.
- `kind` is `feature`, `improvement` (the default) or `fix`.
- `forOperators: true` marks something only a league operator cares about.
- `headline` is a few words for the release's one-line summary. Leave it off
  for small fixes.

Several notes from one PR go in one file as a JSON array.

**At release you do nothing.** `npm version` runs the stamp, which moves every
file here into `releases.ts` under the new version and deletes them. Because
each PR adds its own file, two PRs never conflict.
