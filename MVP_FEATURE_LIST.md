MVP LIST

\*\* = Mobile first build

Minimum needed

1.  create next season flow
2.  rules \*\*
3.  invite system \*\*. xx
4.  schedule management (league operator) - view/modify schedule match ups, and table assignments xx
5.  score match/ match dispute (league operator) interface to manually change and score matches.

IMPORTANT FEATURES

1.  messaging system \*\*
2.  payout calculator
3.  scorecard dispute page (league operator)

FUTURE FEATURES

1. AI integrated rules \*\*
2. AI integrated video shot referee \*\*
3. AI league operator assistant

---

## BACKLOG NOTES

### Email Invite System for Placeholder Players (Researched Dec 2025)

**Concept**: When creating a Placeholder Player, optionally collect email and send invite link.

**Tech Stack**:

- **Resend** (email API): Free tier = 3,000 emails/month, 100/day. No credit card required.
- **Supabase Edge Functions**: Server-side TypeScript to call Resend API.
- Docs: https://supabase.com/docs/guides/functions/examples/send-emails
- Resend + Supabase guide: https://resend.com/docs/send-with-supabase-edge-functions

**Requirements**:

- Own domain for sending (e.g., `invites@rackem-leagues.com`)
- Store `RESEND_API_KEY` in Edge Function secrets

**Flow**:

```
Captain creates PP with optional email
  → Edge Function sends invite with /register?claim={memberId}
  → Player clicks link → registers → auto-linked to PP record
```

**Why This Matters**: Bypasses the merge problem entirely when email is provided upfront. Merge system only needed as fallback for PPs without email or players who ignore invite.
