/**
 * @fileoverview CreateTeamChatPrompt Component
 *
 * Captain-facing manual-fallback prompt rendered above the Messages page
 * conversation list. Implements R11 from the Phase 1 messaging plan: if the
 * season-activation trigger fails to create a team chat (Unit 4), the team's
 * captain has a self-service recovery path here.
 *
 * Visibility: renders nothing when the captain has no active-season teams
 * missing a chat (the common case). Renders one small card per missing chat
 * otherwise.
 */

import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCaptainTeamsMissingChat,
  useCurrentMember,
} from '@/api/hooks';
import { createTeamChat } from '@/api/mutations/autoConversations';
import { queryKeys } from '@/api/queryKeys';

interface CreateTeamChatPromptProps {
  /** Called with the new conversation id after a successful creation. */
  onChatCreated?: (conversationId: string) => void;
}

/**
 * Render zero-or-more captain-facing prompts for teams that need a chat created.
 * Each card shows the team name and a single "Create team chat" button.
 */
export function CreateTeamChatPrompt({
  onChatCreated,
}: CreateTeamChatPromptProps) {
  const queryClient = useQueryClient();
  const { data: member } = useCurrentMember();
  const memberId = member?.id;
  const { data: missing = [] } = useCaptainTeamsMissingChat();

  if (missing.length === 0) return null;

  const handleCreate = async (
    seasonId: string,
    teamId: string,
    teamName: string
  ) => {
    try {
      const { conversationId } = await createTeamChat({ seasonId, teamId });
      toast.success(`Team chat created for ${teamName}`);

      // Refresh the conversation list and re-check missing-chat status so the
      // prompt disappears for this team.
      if (memberId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.messages.conversations(memberId),
        });
      }
      await queryClient.invalidateQueries({
        queryKey: ['messages', 'captainTeamsMissingChat'],
      });

      onChatCreated?.(conversationId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create team chat';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-2 px-2 pb-2">
      {missing.map((team) => (
        <Card key={team.team_id} data-testid="create-team-chat-prompt">
          <CardContent className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0 text-sm">
              <p className="font-medium truncate">{team.team_name}</p>
              <p className="text-muted-foreground text-xs">
                No team chat yet
              </p>
            </div>
            <Button
              size="sm"
              loadingText="Creating..."
              onClick={() =>
                handleCreate(team.season_id, team.team_id, team.team_name)
              }
            >
              <MessageSquarePlus className="h-4 w-4 mr-1" />
              Create team chat
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
