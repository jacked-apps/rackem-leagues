---
title: League Intake Agent — How to Use (step-by-step)
date: 2026-05-17
status: active
audience: Ed
---

# League Intake Agent — How to Use

**TL;DR — when you sit with a league operator:**
1. Open a terminal (any terminal app)
2. `cd ~/Programming/rackem-leagues`
3. `claude`
4. Paste the prompt (instructions below)
5. Either describe the LO's league yourself OR hand them the keyboard

You can be **anywhere inside the repo** when you start Claude Code. The cwd doesn't matter as long as it's somewhere under `~/Programming/rackem-leagues`. Claude Code will read the docs as needed from any subdirectory.

---

## Path A — Claude Code in the repo (in-person with an LO)

**Best for:** sitting with an LO, intake happens live in conversation, you stay in the loop.

### Setup (one time, ~30 seconds the first time)

1. **Open a terminal.** Any terminal app — Terminal.app, iTerm, the VS Code integrated terminal, whatever you use.

2. **Navigate to the repo:**
   ```
   cd ~/Programming/rackem-leagues
   ```
   (Or just `cd` into ANY folder inside the repo — the exact subfolder doesn't matter.)

3. **Start Claude Code:**
   ```
   claude
   ```
   (This opens an interactive Claude Code session in the current directory.)

### Run the intake (every time, ~2 min to start)

4. **Open the prompt file** in any editor:
   - File path: `docs/league-system/intake-agent-prompt.md`
   - Find the section called `## The prompt`
   - The actual prompt is in a markdown code block (between the triple backticks).

5. **Copy the prompt content** (everything inside the code block — start at `You are a league intake agent...`, end at the closing line about `🔴 New Module needed`).

6. **Paste it as the first message** in your Claude Code session. Hit Enter to send.

7. Claude will acknowledge the persona. Now either:
   - **You describe the LO's league** (good for capturing your own thoughts about what one of YOUR existing leagues looks like)
   - **Hand the keyboard to the LO** (good when sitting with someone like Ozzy who knows their league better than you)

8. The session will work through the intake playbook (Team Geometry → Match Format → Handicap System → etc.) and produce a structured summary at the end.

9. **Save the summary somewhere useful** — copy it into `LIST_FOR_ED.md`, paste into Notes, screenshot it, whatever works.

### What to do with the output

The structured summary will flag each Module as one of:
- **✓ Existing variant** → onboard the league with config; no new code needed
- **⚠ New variant needed** → schedule blueprint authoring (probably with Claude, probably a few hours per variant)
- **🔴 New Module needed** → escalate to architectural brainstorm (rare; serious; means a new Module #10)

---

## Path B — Claude.ai Project (LO uses it solo)

**Best for:** sending the intake to an LO who'll use it without you. Takes more setup but reusable across many LOs.

### Setup (one time, ~15 min)

1. **Open a browser.** Go to `https://claude.ai`.

2. **Find the Projects section.** Look in the left sidebar — Projects is usually below the regular chat list.

3. **Create a new Project.** Click "New Project" or similar. Name it something like "rackem-leagues League Intake."

4. **Upload the docs** (this is the part where the LO's Claude session can READ the framework):
   - Upload at minimum: `docs/league-system/PRINCIPLES.md`, `docs/league-system/README.md`, and all 9 Module READMEs (the README.md inside each `modules/X/` subfolder)
   - Better: upload the entire `docs/league-system/` folder (Claude.ai may have folder upload, or you can drag-drop all .md files)

5. **Set the Project's custom instructions:**
   - In the Project settings, find "Custom instructions" or "System prompt"
   - Paste the same prompt content from `docs/league-system/intake-agent-prompt.md` (the `## The prompt` code block)
   - Save

6. **Share the Project** with the LO:
   - Project URL is shareable from the Project settings
   - Send them the link with a brief intro: "Hey, talk to this Claude session about your league — it knows my modular Scoring System framework and will figure out if your league fits or if we need new stuff. Just describe your league and answer its questions."

### Maintenance (when the framework docs change)

If you update the modular Scoring System docs in this repo and want the Project to know about the changes:
- Re-upload the changed files to the Project
- Or delete and re-create the Project with the new doc set
- (There's no auto-sync between this repo and a Claude.ai Project — manual update)

---

## What if my Claude Code session is too small / runs out of context?

The full `docs/league-system/` folder is large but Claude Code reads files on demand — it doesn't load everything upfront. As long as you give it the prompt, it'll fetch the right docs as the conversation needs them.

If you're in a marathon intake session and Claude Code starts feeling sluggish or losing the thread, you can:
- Start a fresh session and re-paste the prompt (Claude Code sessions are isolated)
- Drop the conversation into a `LIST_FOR_ED.md` note so you don't lose the LO's description

---

## Troubleshooting

**"Claude says it doesn't have access to the docs."** Make sure your `cd` put you somewhere inside the repo. Run `pwd` to verify. If `pwd` doesn't show a path containing `rackem-leagues`, `cd` again.

**"Claude is asking architectural questions that should be in the docs."** Make sure you pasted the FULL prompt — the prompt explicitly tells Claude to read the docs as needed. If you only pasted the first paragraph, Claude doesn't know to look.

**"The LO is giving me a description I don't know how to map."** That's the right time to use this tool — Claude (with the docs loaded) will tell you whether it maps to existing variants, needs a new variant, or needs a new Module. Trust the structured output.

**"The intake summary flagged 🔴 New Module needed."** Don't panic. New Modules are rare and usually mean the LO's league has a genuinely novel mechanic. Capture the description carefully and schedule an architectural brainstorm — don't try to force-fit it into existing Modules.

---

## Quick reference card

| Question | Answer |
|---|---|
| Where do I need to be to run this? | Anywhere inside `~/Programming/rackem-leagues` (any subfolder) |
| What command starts Claude Code? | `claude` |
| Where is the prompt? | `docs/league-system/intake-agent-prompt.md` → `## The prompt` section |
| How long does intake take per LO? | 15-30 min if the LO knows their league well |
| What's the output? | A structured Module-composition table flagging ✓/⚠/🔴 per Module |
| What do I do with the output? | Save it somewhere (LIST_FOR_ED.md, Notes, screenshot); use it as the spec for onboarding or for blueprint authoring |
