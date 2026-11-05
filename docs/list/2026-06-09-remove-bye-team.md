---
summary: Add a way to remove a bye team (only "Fill" exists today)
kind: task
added: 2026-06-09
checked: 2026-11-04
---

A bye row in `src/operator/components/TeamCard.tsx` has a **Fill** button (it turns the bye into a real team through `TeamEditorModal`) but no **Remove**.

Add a delete action: delete the bye, then regenerate matchups at the new even team count.
