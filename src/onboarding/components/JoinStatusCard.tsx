/**
 * @fileoverview Presentational status card for the team-join flow.
 *
 * One simple centered card used for every terminal/intermediate state the
 * /join/:token page can land on — waiting for approval, already on the team,
 * roster full, invalid link, declined. Keeps the orchestrator
 * (`TeamJoinPage`) free of repeated card markup.
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 3).
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface JoinStatusCardProps {
  /** Big headline (e.g. "You're on the list!"). */
  title: string;
  /** Supporting sentence under the title. */
  message: string;
  /** Optional action (e.g. a "Go to my team" button). */
  action?: React.ReactNode;
}

/** A centered status card with an optional action below the message. */
export const JoinStatusCard: React.FC<JoinStatusCardProps> = ({
  title,
  message,
  action,
}) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </CardContent>
  </Card>
);
