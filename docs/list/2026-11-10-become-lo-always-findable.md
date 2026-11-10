---
summary: Keep "Become a League Operator" easy to find from anywhere in the app
kind: task
added: 2026-11-10
checked: 2026-11-10
---

Ed, 2026-11-10: as a new user he could not find how to become a league
operator. It used to be on the home page; now it is not on Home, My Teams or
Messages. Growing the number of league operators is a business goal, so the
way in should be around all the time, not hidden.

Where it went: the navigation overhaul (PR #124, May 2026) moved the "Run Your
Own League?" card off the home dashboard and onto the Profile page
(`src/profile/Profile.tsx`, around line 178). The card is still there, shown
only to members who are not operators yet, but nothing else points to it.
The only other door is a link on the Pricing page (`src/about/Pricing.tsx`).

To decide when building: an always-visible door for non-operators, most
likely a sidebar entry in `src/navigation/` (hidden once the member is an
operator), and probably the home card back as well. Keep the Profile card.
The page itself is `/become-league-operator`
(`src/operator/application/BecomeLeagueOperator.tsx`).
