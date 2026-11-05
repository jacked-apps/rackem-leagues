---
summary: Return async calls from sync click handlers so buttons block double taps
kind: task
added: 2026-09-05
checked: 2026-11-04
---

`Button` disables itself while an `onClick` promise is pending, so every
async handler is covered. It can't see a sync handler that calls something
async and throws the promise away. The button stays live and a double tap
fires twice.

`NewMessageModal` and `AnnouncementModal` are already fixed.

## Still discarding, roughly by risk

- `src/components/scoring/ConfirmationDialog.tsx`, `ConfirmationModal.tsx`,
  `ScoringDialog.tsx`: call then `onClose()`. Lower risk, since the modal
  unmounts the button, but a slow close leaves a window.
- `src/components/lineup/LineupActions.tsx`: lineup lock and unlock.
- Wizard steps that save and advance:
  `src/wizards/teams-v2/steps/CaptainsTeamsStep.tsx`,
  `src/components/season/ScheduleReview.tsx`,
  `src/operator/ScheduleSetupPage.tsx`.
- `src/profile/*Section.tsx` and `src/components/operator/ContactInfoCard.tsx`:
  several already pass `disabled={isSaving}`, so they're guarded, just with
  no spinner.

The fix is one line each: `return` the async call, and widen the prop type
from `=> void` to `=> unknown`. No new state.

None of these is known to have misfired.
