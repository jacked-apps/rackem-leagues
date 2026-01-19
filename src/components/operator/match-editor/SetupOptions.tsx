/**
 * @fileoverview Setup Options Component
 *
 * Unified settings component for match format configuration.
 * Consolidates settings that were previously scattered across:
 * - Lineup Options (lineup size, handicap type)
 * - Threshold Options (threshold system, mode)
 * - Games section (round robin type)
 *
 * This component appears on:
 * - Match Data Page (primary location)
 * - Threshold Chart Editor pages (for reference/adjustment)
 *
 * From these 4 settings, we can derive:
 * - Total Games = lineupSize² × roundRobinMultiplier
 * - Chart Type = matches handicap type (points → points chart, percentage → % chart)
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Settings2, Check, Pencil, AlertTriangle } from 'lucide-react';
import { InfoButton } from '@/components/InfoButton';

/**
 * Setup issue type for tracking configuration problems
 */
interface SetupIssue {
  id: string;
  severity: 'warning' | 'error';
  title: string;
  description: string;
}

/**
 * Handicap type determines how player handicaps are calculated and compared
 * - points: Integer-based handicaps (e.g., -5 to +10), used in 3v3 formats
 * - percentage: Percentage-based handicaps (e.g., 45% to 78%), used in 5v5 formats
 * - custom: Manual handicap entry, no automatic calculation
 */
export type HandicapType = 'points' | 'percentage' | 'custom';

/**
 * Threshold mode determines how match winners are calculated
 * - team: Compare total team games won against threshold
 * - player: Compare individual player matchup results (head-to-head)
 * - off: No automatic threshold calculation, manual entry
 */
export type ThresholdMode = 'team' | 'player' | 'off';

/**
 * Game format determines how games are structured and total count
 * - single_rr: Single round robin - each player plays every opponent once (lineupSize²)
 * - double_rr: Double round robin - each player plays every opponent twice (lineupSize² × 2)
 * - individual_race: Individual race - player 1H vs 1A, player 2H vs 2A, etc. (lineupSize games)
 * - custom: Manual total games entry
 */
export type GameFormat = 'single_rr' | 'double_rr' | 'individual_race' | 'custom';

/**
 * Setup options configuration
 */
export interface SetupOptionsConfig {
  /** Number of players per team (3, 4, 5, etc.) */
  lineupSize: number;
  /** Handicap calculation method */
  handicapType: HandicapType;
  /** How thresholds are applied */
  thresholdMode: ThresholdMode;
  /** Game format - how games are structured */
  gameFormat: GameFormat;
  /** Custom total games (only used when gameFormat is 'custom') */
  customTotalGames?: number;
}

/**
 * Calculate total games based on lineup size and game format
 */
export function calculateTotalGames(config: SetupOptionsConfig): number {
  const { lineupSize, gameFormat, customTotalGames } = config;

  switch (gameFormat) {
    case 'single_rr':
      // Single round robin: each player plays every opponent once
      return lineupSize * lineupSize;
    case 'double_rr':
      // Double round robin: each player plays every opponent twice
      return lineupSize * lineupSize * 2;
    case 'individual_race':
      // Individual race: player 1H vs 1A, player 2H vs 2A, etc.
      // Each position plays one matchup = lineupSize total matchups
      return lineupSize;
    case 'custom':
      return customTotalGames ?? lineupSize * lineupSize;
    default:
      return lineupSize * lineupSize;
  }
}

/**
 * Get default setup options based on common formats
 */
export function getDefaultSetupOptions(handicapType: HandicapType): SetupOptionsConfig {
  if (handicapType === 'percentage') {
    // 5v5 percentage format: 5 players, single round robin = 25 games
    return {
      lineupSize: 5,
      handicapType: 'percentage',
      thresholdMode: 'team',
      gameFormat: 'single_rr',
    };
  } else {
    // 3v3 points format: 3 players, single round robin = 9 games
    // (Default to single to avoid overwhelming game counts for custom sizes)
    return {
      lineupSize: 3,
      handicapType: 'points',
      thresholdMode: 'team',
      gameFormat: 'single_rr',
    };
  }
}

/** Standard lineup sizes that our system fully supports */
const STANDARD_LINEUP_SIZES = [3, 4, 5] as const;

/**
 * Players Per Team Selector
 *
 * Shows buttons for standard sizes (3, 4, 5) plus a Custom option.
 * Custom sizes > 5 show a warning about potential scoring issues.
 */
function PlayersPerTeamSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (size: number) => void;
}) {
  // Track if we're in custom mode (showing input field)
  const isStandardSize = STANDARD_LINEUP_SIZES.includes(value as 3 | 4 | 5);
  const [isCustomMode, setIsCustomMode] = useState(!isStandardSize);
  const [customInputValue, setCustomInputValue] = useState(
    isStandardSize ? '' : String(value)
  );

  /**
   * Handle selecting a standard size
   */
  const handleStandardSelect = (size: number) => {
    setIsCustomMode(false);
    setCustomInputValue('');
    onChange(size);
  };

  /**
   * Handle clicking the Custom button
   */
  const handleCustomClick = () => {
    setIsCustomMode(true);
    // If current value is standard, start with 6
    if (isStandardSize) {
      setCustomInputValue('6');
      onChange(6);
    }
  };

  /**
   * Handle custom input change
   */
  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    setCustomInputValue(inputVal);

    const parsed = parseInt(inputVal, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 20) {
      onChange(parsed);
    }
  };

  /**
   * Handle custom input blur - validate and clean up
   */
  const handleCustomInputBlur = () => {
    const parsed = parseInt(customInputValue, 10);
    if (isNaN(parsed) || parsed < 1) {
      // Reset to 6 if invalid
      setCustomInputValue('6');
      onChange(6);
    } else if (parsed > 20) {
      // Cap at 20
      setCustomInputValue('20');
      onChange(20);
    } else {
      setCustomInputValue(String(parsed));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm text-gray-600">Players per Team:</Label>
        <span onClick={(e) => e.stopPropagation()}>
          <InfoButton title="Players per Team" size="sm">
            <p className="mb-2">
              Number of players on each team lineup. Common formats:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm mb-2">
              <li><strong>3v3:</strong> Typical for points-based handicap leagues</li>
              <li><strong>4v4:</strong> Less common, works with both systems</li>
              <li><strong>5v5:</strong> Typical for percentage-based (BCA) leagues</li>
            </ul>
            <p className="text-xs text-gray-500">
              Custom sizes above 5 may require additional configuration and are not fully tested with player scoring.
            </p>
          </InfoButton>
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Standard size buttons */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          {STANDARD_LINEUP_SIZES.map((size) => (
            <Button
              key={size}
              type="button"
              variant={value === size && !isCustomMode ? 'secondary' : 'ghost'}
              size="sm"
              className={`px-3 py-1 h-7 text-xs ${
                value === size && !isCustomMode
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-transparent hover:bg-gray-200'
              }`}
              onClick={() => handleStandardSelect(size)}
            >
              {size}
            </Button>
          ))}

          {/* Custom button */}
          <Button
            type="button"
            variant={isCustomMode ? 'secondary' : 'ghost'}
            size="sm"
            className={`px-3 py-1 h-7 text-xs ${
              isCustomMode
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-transparent hover:bg-gray-200'
            }`}
            onClick={handleCustomClick}
          >
            Custom
          </Button>
        </div>

        {/* Custom input field */}
        {isCustomMode && (
          <Input
            type="number"
            min="1"
            max="20"
            value={customInputValue}
            onChange={handleCustomInputChange}
            onBlur={handleCustomInputBlur}
            className="w-16 h-7 text-center text-sm"
            placeholder="6"
          />
        )}
      </div>
      {/* Note: Warning for sizes > 5 is now shown in Setup Issues section */}
    </div>
  );
}

/**
 * Get setup issues based on current configuration
 */
function getSetupIssues(config: SetupOptionsConfig): SetupIssue[] {
  const issues: SetupIssue[] = [];

  // Check for custom lineup size > 5
  if (config.lineupSize > 5) {
    issues.push({
      id: 'large-lineup',
      severity: 'warning',
      title: 'Custom lineup size',
      description: `Lineup sizes greater than 5 (currently ${config.lineupSize}v${config.lineupSize}) are not fully supported by player scoring. You may need to use manual scoring or contact support for assistance.`,
    });
  }

  return issues;
}

interface SetupOptionsProps {
  /** Current configuration */
  config: SetupOptionsConfig;
  /** Callback when configuration changes */
  onChange: (config: SetupOptionsConfig) => void;
  /** Callback when save is clicked */
  onSave?: () => void;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Whether there are saved options (affects default accordion state) */
  hasSavedOptions?: boolean;
  /** Whether the component is read-only (view mode only) */
  readOnly?: boolean;
  /** Default accordion state */
  defaultExpanded?: boolean;
}

/**
 * Setup Options Component
 *
 * Collapsible accordion containing all match format settings.
 * Single source of truth for lineup size, handicap type, threshold mode, and round robin type.
 */
export function SetupOptions({
  config,
  onChange,
  onSave,
  isSaving = false,
  hasSavedOptions = false,
  readOnly = false,
  defaultExpanded = false,
}: SetupOptionsProps) {
  const [isEditing, setIsEditing] = useState(!hasSavedOptions);
  const [issuesAcknowledged, setIssuesAcknowledged] = useState(false);

  const totalGames = calculateTotalGames(config);
  const issues = getSetupIssues(config);
  const hasIssues = issues.length > 0;

  /**
   * Update a single field in the config
   */
  const updateField = <K extends keyof SetupOptionsConfig>(
    field: K,
    value: SetupOptionsConfig[K]
  ) => {
    onChange({ ...config, [field]: value });
  };

  /**
   * Handle handicap type change - also updates lineup size and game format defaults
   */
  const handleHandicapTypeChange = (type: HandicapType) => {
    if (type === 'percentage') {
      onChange({
        ...config,
        handicapType: type,
        lineupSize: 5,
        gameFormat: 'single_rr',
      });
    } else {
      onChange({
        ...config,
        handicapType: type,
        lineupSize: 3,
        gameFormat: 'double_rr',
      });
    }
  };

  const handleSave = () => {
    onSave?.();
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  // Labels for display
  const getHandicapLabel = (type: HandicapType) => {
    switch (type) {
      case 'points': return 'Points';
      case 'percentage': return 'Percentage';
      case 'custom': return 'Custom';
    }
  };

  const getModeLabel = (mode: ThresholdMode) => {
    switch (mode) {
      case 'team':
        return 'Team';
      case 'player':
        return 'Player';
      case 'off':
        return 'Off';
    }
  };

  const getGameFormatLabel = (format: GameFormat) => {
    switch (format) {
      case 'single_rr':
        return 'Single RR';
      case 'double_rr':
        return 'Double RR';
      case 'individual_race':
        return 'Individual Race';
      case 'custom':
        return 'Custom';
    }
  };

  return (
    <Card>
      <Accordion
        type="single"
        collapsible
        defaultValue={defaultExpanded || !hasSavedOptions ? 'setup' : ''}
      >
        <AccordionItem value="setup" className="border-b-0">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <div className="flex items-center gap-2 text-base font-semibold">
              <Settings2 className="h-4 w-4" />
              Setup Options
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({config.lineupSize}v{config.lineupSize} • {getHandicapLabel(config.handicapType)} •{' '}
                {totalGames} games)
              </span>
              <span onClick={(e) => e.stopPropagation()}>
                <InfoButton title="Setup Options" size="sm">
                  <p className="mb-2">
                    These settings define the match format and determine how thresholds are
                    calculated.
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm mb-2">
                    <li>
                      <strong>Players per Team:</strong> Number of players on each team lineup
                    </li>
                    <li>
                      <strong>Handicap Type:</strong> Points (3v3 format), Percentage (5v5 format), or Custom
                    </li>
                    <li>
                      <strong>Thresholds For:</strong> Team-based, player-based, or off
                    </li>
                    <li>
                      <strong>Format:</strong> Single RR, Double RR, Individual Race, or Custom
                    </li>
                  </ul>
                  <p className="text-xs text-gray-500">
                    Total Games varies by format: Round Robin = n², Individual Race = n
                  </p>
                </InfoButton>
              </span>
              {hasSavedOptions && !isEditing && (
                <span className="text-xs font-normal text-green-600 ml-2">
                  <Check className="h-3 w-3 inline mr-1" />
                  Saved
                </span>
              )}
            </div>
          </AccordionTrigger>

          <AccordionContent className="px-6 pb-4">
            <div className="space-y-4">
              {isEditing && !readOnly ? (
                /* Edit Mode */
                <>
                  {/* Handicap Type */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-gray-600">Handicap Type:</Label>
                      <span onClick={(e) => e.stopPropagation()}>
                        <InfoButton title="Handicap Type" size="sm">
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>
                              <strong>Points:</strong> Integer handicaps (e.g., -5 to +10). Used in
                              3v3 formats with 18 games (double round robin).
                            </li>
                            <li>
                              <strong>Percentage:</strong> Percentage handicaps (e.g., 45% to 78%).
                              Used in 5v5 formats with 25 games (single round robin).
                            </li>
                            <li>
                              <strong>Custom:</strong> Manual handicap entry. Use this if your
                              league uses a different handicap system.
                            </li>
                          </ul>
                        </InfoButton>
                      </span>
                    </div>
                    <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
                      {(['points', 'percentage', 'custom'] as HandicapType[]).map((type) => (
                        <Button
                          key={type}
                          type="button"
                          variant={config.handicapType === type ? 'secondary' : 'ghost'}
                          size="sm"
                          className={`px-3 py-1 h-7 text-xs ${
                            config.handicapType === type
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-transparent hover:bg-gray-200'
                          }`}
                          onClick={() => handleHandicapTypeChange(type)}
                        >
                          {getHandicapLabel(type)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Players per Team */}
                  <PlayersPerTeamSelector
                    value={config.lineupSize}
                    onChange={(size) => updateField('lineupSize', size)}
                  />

                  {/* Threshold Mode */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-gray-600">Thresholds For:</Label>
                      <span onClick={(e) => e.stopPropagation()}>
                        <InfoButton title="Threshold Mode" size="sm">
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>
                              <strong>Team:</strong> Thresholds apply to the team as a whole.
                            </li>
                            <li>
                              <strong>Player:</strong> Thresholds apply per player matchup.
                            </li>
                            <li>
                              <strong>Off:</strong> No automatic threshold calculation.
                            </li>
                          </ul>
                        </InfoButton>
                      </span>
                    </div>
                    <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
                      {(['team', 'player', 'off'] as ThresholdMode[]).map((mode) => (
                        <Button
                          key={mode}
                          type="button"
                          variant={config.thresholdMode === mode ? 'secondary' : 'ghost'}
                          size="sm"
                          className={`px-3 py-1 h-7 text-xs ${
                            config.thresholdMode === mode
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-transparent hover:bg-gray-200'
                          }`}
                          onClick={() => updateField('thresholdMode', mode)}
                        >
                          {getModeLabel(mode)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Game Format */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-gray-600">Format:</Label>
                      <span onClick={(e) => e.stopPropagation()}>
                        <InfoButton title="Game Format" size="sm">
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>
                              <strong>Single RR:</strong> Single round robin - each player plays every
                              opponent once. Total = {config.lineupSize}² = {config.lineupSize * config.lineupSize} games.
                            </li>
                            <li>
                              <strong>Double RR:</strong> Double round robin - each player plays every
                              opponent twice. Total = {config.lineupSize}² × 2 = {config.lineupSize * config.lineupSize * 2} games.
                            </li>
                            <li>
                              <strong>Individual Race:</strong> Position matchups - Player 1H vs 1A,
                              Player 2H vs 2A, etc. Total = {config.lineupSize} matchups.
                            </li>
                            <li>
                              <strong>Custom:</strong> Manual total games entry for other formats.
                            </li>
                          </ul>
                        </InfoButton>
                      </span>
                    </div>
                    <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
                      {(['single_rr', 'double_rr', 'individual_race', 'custom'] as GameFormat[]).map((format) => (
                        <Button
                          key={format}
                          type="button"
                          variant={config.gameFormat === format ? 'secondary' : 'ghost'}
                          size="sm"
                          className={`px-3 py-1 h-7 text-xs ${
                            config.gameFormat === format
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-transparent hover:bg-gray-200'
                          }`}
                          onClick={() => updateField('gameFormat', format)}
                        >
                          {getGameFormatLabel(format)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Total Games Display */}
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {config.gameFormat === 'individual_race' ? 'Total Matchups:' : 'Total Games:'}
                      </span>
                      <span className="text-lg font-semibold">{totalGames}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {config.gameFormat === 'individual_race'
                        ? `${config.lineupSize} position matchups per match`
                        : `${config.lineupSize}² ${config.gameFormat === 'double_rr' ? '× 2' : ''} = ${totalGames} games per match`
                      }
                    </p>
                  </div>

                  {/* Setup Issues Section */}
                  {hasIssues && (
                    <div className="space-y-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-800">
                          Setup Issues
                        </span>
                        <span onClick={(e) => e.stopPropagation()}>
                          <InfoButton title="Setup Issues" size="sm">
                            <p className="mb-2">
                              Some configuration options may cause issues with scoring or other features.
                            </p>
                            <p className="mb-2">
                              Our goal is to support all handicap systems, but we may not have encountered
                              your particular format yet. Custom configurations may require manual scoring
                              until we add full support for your system.
                            </p>
                            <p className="text-xs text-gray-500">
                              Have a format we don't support yet? Contact us at support@rackemleagues.com
                              and we'll work to add it.
                            </p>
                          </InfoButton>
                        </span>
                      </div>

                      {/* Issue list */}
                      <div className="space-y-2">
                        {issues.map((issue) => (
                          <div key={issue.id} className="text-xs text-amber-800">
                            <p className="font-medium">{issue.title}</p>
                            <p>{issue.description}</p>
                          </div>
                        ))}
                      </div>

                      {/* Acknowledgement checkbox */}
                      <div className="flex items-start gap-2 pt-2 border-t border-amber-200">
                        <Checkbox
                          id="acknowledge-issues"
                          checked={issuesAcknowledged}
                          onCheckedChange={(checked) => setIssuesAcknowledged(checked === true)}
                        />
                        <Label
                          htmlFor="acknowledge-issues"
                          className="text-xs text-amber-800 cursor-pointer leading-tight"
                        >
                          I understand the issues and want to use this configuration anyway
                        </Label>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  {onSave && (
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <Button
                        type="button"
                        size="sm"
                        loadingText="Saving..."
                        isLoading={isSaving}
                        onClick={handleSave}
                        disabled={hasIssues && !issuesAcknowledged}
                        className="h-8"
                      >
                        Save Options
                      </Button>
                      {hasSavedOptions && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCancel}
                          disabled={isSaving}
                          className="h-8"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* View Mode */
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-gray-600">Handicap Type:</Label>
                      <span className="text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                        {getHandicapLabel(config.handicapType)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-gray-600">Players:</Label>
                      <span className="text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                        {config.lineupSize}v{config.lineupSize}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-gray-600">Thresholds:</Label>
                      <span className="text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                        {getModeLabel(config.thresholdMode)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-gray-600">Format:</Label>
                      <span className="text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                        {getGameFormatLabel(config.gameFormat)}
                      </span>
                    </div>
                  </div>

                  {/* Total Games Display */}
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Games:</span>
                      <span className="text-lg font-semibold">{totalGames}</span>
                    </div>
                  </div>

                  {/* Edit button */}
                  {!readOnly && (
                    <div className="pt-2 border-t border-gray-100">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        className="h-8"
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit Options
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
