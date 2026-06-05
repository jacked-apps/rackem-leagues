/**
 * @fileoverview `ScoringSettingsMenu` — the gear-icon settings popover in the
 * live-scoring header. Collects the scorer's per-screen preferences in one
 * place (the header corner was getting cramped with a lone checkbox):
 *
 *  • **Auto-Confirm** — auto-accept opponent scores without a modal.
 *  • **I'm not scoring** — silence the confirm/vacate prompts entirely.
 *  • **Game order** — Break/Rack vs Home/Away column arrangement (mirror of the
 *    games-list header bar; either control flips the same shared preference).
 *
 * The component is presentational: it owns no state, just renders the current
 * values and calls back on change. Persistence + mutual exclusion live in the
 * hooks behind these props (useScoringParticipationModes, useGameDisplayMode).
 *
 * Each row carries an InfoButton. InfoButton renders its help popup as an
 * in-DOM child (not a portal), so it stays inside this Popover's content node
 * and tapping `?` won't dismiss the gear menu.
 */

import { Settings } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { InfoButton } from '@/components/InfoButton';
import type { DisplayMode } from '@/hooks/useGameDisplayMode';

interface ScoringSettingsMenuProps {
  autoConfirm: boolean;
  onAutoConfirmChange: (value: boolean) => void;
  notScoring: boolean;
  onNotScoringChange: (value: boolean) => void;
  displayMode: DisplayMode;
  onToggleDisplayMode: () => void;
}

export function ScoringSettingsMenu({
  autoConfirm,
  onAutoConfirmChange,
  notScoring,
  onNotScoringChange,
  displayMode,
  onToggleDisplayMode,
}: ScoringSettingsMenuProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Scoring settings"
          loadingText="none"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4">
        {/* Auto-Confirm */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="setting-auto-confirm">Auto-Confirm</Label>
            <InfoButton
              title="Auto-Confirm Opponent Selections"
              size="sm"
              align="left"
            >
              <p className="text-sm">
                By enabling this your opponents game result selections will
                automatically be confirmed for your team. Your team is still
                responsible for ensuring the scoring is accurate. This option
                simply removes the need to confirm each game individually. It
                resets when you leave this page.
              </p>
            </InfoButton>
          </div>
          <Switch
            id="setting-auto-confirm"
            checked={autoConfirm}
            onCheckedChange={onAutoConfirmChange}
          />
        </div>

        {/* I'm not scoring */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="setting-not-scoring">I'm not scoring</Label>
            <InfoButton title="I'm Not Scoring" size="sm" align="left">
              <p className="text-sm">
                Hides the confirmation pop-ups so you won&apos;t be asked to
                confirm games. Nothing is confirmed or denied on your behalf —
                the prompts are simply silenced. You can still tap any game to
                review and confirm it yourself if you want to. Lasts for this
                match.
              </p>
            </InfoButton>
          </div>
          <Switch
            id="setting-not-scoring"
            checked={notScoring}
            onCheckedChange={onNotScoringChange}
          />
        </div>

        {/* Game order (mirror of the games-list header bar) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Label>Game order</Label>
            <InfoButton title="Game Order" size="sm" align="left">
              <p className="text-sm">
                Switches how each game&apos;s two players are arranged.
                Break/Rack shows the breaker on the left; Home/Away always shows
                the home team on the left. You can also tap the column headers
                above the games to switch. Saved as your preference.
              </p>
            </InfoButton>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleDisplayMode}
            loadingText="none"
          >
            {displayMode === 'break-rack' ? 'Break / Rack' : 'Home / Away'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
