/**
 * @fileoverview Stats Navigation Bar Component
 *
 * Horizontal navigation bar for switching between stats pages.
 * Shows: Standings | Top Shooters | Team Stats | Feats of Excellence
 * Highlights the current active page.
 */

import { useNavigate, useParams } from 'react-router-dom';
import { Trophy, Target, Users, Award } from 'lucide-react';

interface StatsNavBarProps {
  /** Current active page */
  activePage: 'standings' | 'top-shooters' | 'team-stats' | 'feats';
}

/**
 * Stats Navigation Bar Component
 *
 * Provides quick navigation between all stats pages for a season.
 * Uses icons and labels for each stats page.
 *
 * @param activePage - Which page is currently active (for highlighting)
 */
export function StatsNavBar({ activePage }: StatsNavBarProps) {
  const navigate = useNavigate();
  const { leagueId, seasonId } = useParams<{ leagueId: string; seasonId: string }>();
  // const { data: member } = useCurrentMember();

  // Check if current user is a league operator
  // const isOperator = member?.role === 'league_operator';

  const navItems = [
    {
      id: 'standings' as const,
      label: 'Standings',
      icon: Trophy,
      path: `/league/${leagueId}/season/${seasonId}/standings`,
    },
    {
      id: 'top-shooters' as const,
      label: 'Top Shooters',
      icon: Target,
      path: `/league/${leagueId}/season/${seasonId}/top-shooters`,
    },
    {
      id: 'team-stats' as const,
      label: 'Team Stats',
      icon: Users,
      path: `/league/${leagueId}/season/${seasonId}/team-stats`,
    },
    {
      id: 'feats' as const,
      label: 'Feats',
      icon: Award,
      path: `/league/${leagueId}/season/${seasonId}/feats`,
    },
  ];

  return (
    <div className="bg-card lg:rounded-xl border-b border-border mb-6 -mx-4 px-4 overflow-x-auto">
      <nav className="flex gap-1 min-w-max">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`
                flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap
                ${
                  isActive
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
