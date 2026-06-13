/**
 * @fileoverview Announcement Modal
 *
 * Modal for creating announcements to leagues and organizations.
 * Features:
 * - Lists all leagues where user is a captain
 * - Lists organizations (for operators/devs)
 * - Allows selection of one or more targets for announcement
 * - Text area for announcement content
 * - Creates read-only announcement messages
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Megaphone, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/supabaseClient';
import { Modal, LoadingState, EmptyState } from '@/components/shared';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';

interface AnnouncementTarget {
  id: string;
  name: string;
  type: 'league' | 'organization';
  season_id?: string;
  season_name?: string;
}

interface AnnouncementModalProps {
  onClose: () => void;
  onCreateAnnouncement: (targets: AnnouncementTarget[], message: string) => void;
  currentUserId: string;
  canAccessOperatorFeatures: boolean;
}

export function AnnouncementModal({
  onClose,
  onCreateAnnouncement,
  currentUserId,
  canAccessOperatorFeatures,
}: AnnouncementModalProps) {
  const [targets, setTargets] = useState<AnnouncementTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [announcementText, setAnnouncementText] = useState('');
  const maxLength = 500;

  // Fetch announcement targets (leagues and organizations)
  useEffect(() => {
    async function fetchAnnouncementTargets() {
      const allTargets: AnnouncementTarget[] = [];

      // Get teams where user is captain
      const { data: captainTeams, error: teamsError } = await supabase
        .from('team_players')
        .select('team_id, teams!inner(id, league_id, season_id)')
        .eq('member_id', currentUserId)
        .eq('is_captain', true);

      if (teamsError) {
        logger.error('Error fetching captain leagues', { error: teamsError.message });
        setLoading(false);
        return;
      }

      // Get unique league and season IDs
      const leagueSeasonPairs = new Map<string, { leagueId: string; seasonId: string }>();

      (captainTeams || []).forEach((item: any) => {
        const team = item.teams;
        const leagueId = team.league_id;
        const seasonId = team.season_id;

        if (!leagueSeasonPairs.has(leagueId)) {
          leagueSeasonPairs.set(leagueId, { leagueId, seasonId });
        }
      });

      // Fetch league targets
      const leaguePromises = Array.from(leagueSeasonPairs.values()).map(async ({ leagueId, seasonId }) => {
        // Fetch league data
        const { data: league, error: leagueError } = await supabase
          .from('leagues')
          .select('id, game_type, day_of_week, division, league_start_date')
          .eq('id', leagueId)
          .single();

        if (leagueError) {
          logger.error('Error fetching league', { error: leagueError.message });
          return null;
        }

        // Fetch season data
        const { data: season, error: seasonError } = await supabase
          .from('seasons')
          .select('id, season_name')
          .eq('id', seasonId)
          .single();

        if (seasonError) {
          logger.error('Error fetching season', { error: seasonError.message });
          return null;
        }

        if (!league || !season) return null;

        // Build simple league display name from available data
        const gameNames: Record<string, string> = {
          'eight_ball': '8-Ball',
          'nine_ball': '9-Ball',
          'ten_ball': '10-Ball'
        };
        const gameName = gameNames[league.game_type] || league.game_type;
        const dayName = league.day_of_week.charAt(0).toUpperCase() + league.day_of_week.slice(1);
        const divisionPart = league.division ? ` (${league.division})` : '';
        const leagueName = `${gameName} ${dayName}${divisionPart}`;

        return {
          id: leagueId,
          name: leagueName,
          type: 'league' as const,
          season_id: seasonId,
          season_name: season.season_name,
        };
      });

      const leagueTargets = (await Promise.all(leaguePromises)).filter((t) => t !== null);
      allTargets.push(...leagueTargets);

      // Fetch organization targets (if user has operator access)
      if (canAccessOperatorFeatures) {
        const { data: staffData } = await supabase
          .from('organization_staff')
          .select('organization_id, organizations!inner(id, organization_name)')
          .eq('member_id', currentUserId)
          .order('added_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (staffData && staffData.organizations) {
          const org = staffData.organizations as any;
          allTargets.push({
            id: org.id,
            name: `${org.organization_name} (Organization)`,
            type: 'organization',
          });
        }
      }

      setTargets(allTargets);
      setLoading(false);
    }

    fetchAnnouncementTargets();
  }, [currentUserId, canAccessOperatorFeatures]);

  const handleToggleTarget = (targetId: string) => {
    setSelectedTargetIds((prev) =>
      prev.includes(targetId)
        ? prev.filter((id) => id !== targetId)
        : [...prev, targetId]
    );
  };

  const handleCreate = () => {
    if (selectedTargetIds.length === 0) {
      toast.error('Please select at least one target');
      return;
    }

    if (!announcementText.trim()) {
      toast.error('Please enter an announcement message');
      return;
    }

    const selectedTargets = targets.filter((t) => selectedTargetIds.includes(t.id));
    onCreateAnnouncement(selectedTargets, announcementText);
  };

  const selectedTargets = targets.filter((t) => selectedTargetIds.includes(t.id));

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Create Announcement"
      icon={<Megaphone className="h-5 w-5 text-info" />}
      maxWidth="2xl"
    >
      <Modal.Body className="p-0">
        {/* Selected Targets */}
        {selectedTargetIds.length > 0 && (
          <div className="px-6 pt-4 border-b bg-info/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-info">
                Selected ({selectedTargetIds.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pb-4">
              {selectedTargets.map((target) => (
                <div
                  key={target.id}
                  className="bg-card border border-info/40 rounded-full px-3 py-1 text-sm flex items-center gap-2"
                >
                  <span>
                    {target.name}
                    {target.season_name && ` (${target.season_name})`}
                  </span>
                  <button
                    onClick={() => handleToggleTarget(target.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Target List */}
        <div className="flex-1 overflow-y-auto p-6">
          <Label className="text-base font-semibold mb-3 block">
            Select Target(s) for Announcement
          </Label>

          {loading ? (
            <LoadingState message="Loading targets..." />
          ) : targets.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No announcement targets available"
              description="You must be a captain or operator to send announcements"
            />
          ) : (
            <div className="space-y-2">
              {targets.map((target) => (
                <button
                  key={target.id}
                  onClick={() => handleToggleTarget(target.id)}
                  className={cn(
                    'w-full p-4 rounded-lg border-2 transition-all text-left',
                    selectedTargetIds.includes(target.id)
                      ? 'border-info bg-info/10'
                      : 'border-border hover:border-border hover:bg-muted'
                  )}
                >
                  <div className="font-medium text-foreground">{target.name}</div>
                  {target.season_name && (
                    <div className="text-sm text-muted-foreground mt-1">Season: {target.season_name}</div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {target.type === 'league' ? 'League' : 'Organization-wide'}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Announcement Text */}
          {targets.length > 0 && (
            <div className="mt-6">
              <Label htmlFor="announcement" className="text-base font-semibold mb-3 block">
                Announcement Message
              </Label>
              <Textarea
                id="announcement"
                className="min-h-[120px]"
                placeholder="Enter your announcement message..."
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value.slice(0, maxLength))}
                maxLength={maxLength}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {announcementText.length}/{maxLength} characters
              </p>
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button
          loadingText="Sending..."
          onClick={handleCreate}
          disabled={selectedTargetIds.length === 0 || !announcementText.trim()}
          className="flex-1"
        >
          {selectedTargetIds.length === 0
            ? 'Select Target'
            : `Send to ${selectedTargetIds.length} Target${selectedTargetIds.length > 1 ? 's' : ''}`}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
