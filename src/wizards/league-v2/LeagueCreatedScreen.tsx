/**
 * @fileoverview Success screen shown after a league is created via Wizard 2.0
 *
 * Offers navigation to the league detail page or back to the dashboard.
 * Displayed by LeagueWizardV2Page after the dual-write mutation succeeds.
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface LeagueCreatedScreenProps {
  leagueId: string;
  orgId: string;
}

export function LeagueCreatedScreen({ leagueId, orgId }: LeagueCreatedScreenProps) {
  const navigate = useNavigate();

  return (
    <div className="text-center py-12 space-y-6">
      <div className="text-5xl">🎱</div>
      <h2 className="text-2xl font-bold">League Created</h2>
      <p className="text-gray-600">
        Your league has been created. Next, set up the season schedule
        and teams to get started.
      </p>
      <div className="flex justify-center gap-3">
        <Button
          variant="outline"
          onClick={() => navigate(`/operator-dashboard/${orgId}`)}
        >
          Back to Dashboard
        </Button>
        <Button
          loadingText="none"
          onClick={() => navigate(`/league/${leagueId}`)}
        >
          Go to League
        </Button>
      </div>
    </div>
  );
}
