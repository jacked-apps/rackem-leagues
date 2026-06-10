/**
 * @fileoverview In-app captain invite help — the condensed, scannable version of
 * the captain onboarding guide, rendered inside the InfoButton popup next to the
 * "Invite my team" button.
 *
 * Kept deliberately plain and hand-holdy: a first-time captain (or a not-very-
 * techy one) should be able to follow it without a phone call. The fuller
 * walk-through lives in docs/guides/captain-onboarding-guide.md; this is the
 * at-a-glance version the captain sees right where they do the work.
 */

import React from 'react';

/**
 * The body shown inside the invite InfoButton popup. Presentational only — no
 * props, no state. Passed as `children` to <InfoButton>.
 */
export const InviteHelpContent: React.FC = () => (
  <div className="space-y-3">
    <p>
      You have <strong>one link</strong> for your team. The whole job is:
      share that link, then tap <strong>Add</strong> for each player as they
      sign up. That's it.
    </p>

    <ol className="list-decimal space-y-2 pl-5">
      <li>
        Tap <strong>Invite my team</strong>, then{' '}
        <strong>Copy invite message</strong>. (Nothing to type — your name,
        team, and link are already in it.)
      </li>
      <li>
        <strong>Paste it into any message your players will see</strong> — a
        group text to the whole team, a one-on-one text, or email.
      </li>
      <li>
        <strong>Send it.</strong> Same message and link for everybody.
      </li>
      <li>
        <strong>Your players will follow the instructions, so just wait</strong>{' '}
        until you get a message to accept them. When you open that, you're almost
        finished — further instructions will be right there for you.
      </li>
    </ol>
  </div>
);
