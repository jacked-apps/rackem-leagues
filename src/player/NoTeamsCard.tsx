/**
 * @fileoverview NoTeamsCard — what My Teams shows a member who is on no team.
 *
 * Signing in lands on My Teams, which used to say only "You are not currently
 * on any teams" and stop there. A brand-new member had no next step. This card
 * says how a player gets onto a team (a captain adds them or sends a join link)
 * and points to the Home page, which holds the other ways in: running your own
 * league today, and finding a league once the league finder is built.
 */

import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, ArrowRight } from 'lucide-react';

/** Empty state for My Teams; takes no props. */
export function NoTeamsCard() {
  const navigate = useNavigate();

  return (
    <Card>
      <CardContent className="p-8 text-center space-y-4">
        <Users className="h-12 w-12 text-muted-foreground mx-auto" />
        <div className="space-y-1">
          <p className="font-medium">You're not on any teams yet</p>
          <p className="text-sm text-muted-foreground">
            A captain can add you to their team or send you a join link.
          </p>
        </div>
        <Button loadingText="none" onClick={() => navigate('/')}>
          See more options on the Home page
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
