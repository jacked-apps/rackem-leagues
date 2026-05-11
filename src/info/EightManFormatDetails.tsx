/**
 * @fileoverview Detailed 8-Man Team Format Explanation Page
 * Comprehensive guide to the traditional 8-man team format and BCA standard handicap system
 * Accessible to operators considering this format for their league
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const EightManFormatDetails: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-muted py-12 px-4 sm:px-6 lg:px-8">
      {/* Sticky Back Button */}
      <div className="fixed top-20 right-4 z-50">
        <Button
          variant="default"
          loadingText="none"
          onClick={() => navigate(-1)}
          size="lg"
          className="shadow-lg"
        >
          ← Back
        </Button>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            8-Man Team Format: Complete Guide
          </h1>
          <p className="text-xl text-muted-foreground">
            The traditional BCA standard format familiar to experienced league players
          </p>
        </div>

        {/* Overview */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-4">Overview</h2>
          <p className="text-foreground mb-4">
            The 8-man team format is the traditional BCA (Billiard Congress of America) standard that has been
            used for decades in pool leagues across the country. It's familiar to experienced players and
            follows well-established rules and handicap systems.
          </p>
          <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
            <p className="font-semibold text-blue-900">Key Characteristics:</p>
            <ul className="list-disc ml-5 mt-2 text-blue-800">
              <li>Traditional format with established history</li>
              <li>Larger rosters (8+ players per team)</li>
              <li>BCA standard handicap tables</li>
              <li>Single round robin format (everyone plays everyone once)</li>
              <li>Longer match duration (3-4 hours typical)</li>
            </ul>
          </div>
        </Card>

        {/* How It Works */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-4">How It Works</h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Team Structure</h3>
              <ul className="list-disc ml-5 text-foreground space-y-1">
                <li><strong>Roster Size:</strong> 8+ players per team (often 10-12 for coverage)</li>
                <li><strong>Active Players:</strong> 5 players compete on match night</li>
                <li><strong>Substitutions:</strong> Larger roster provides more coverage for absences</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Match Format</h3>
              <ul className="list-disc ml-5 text-foreground space-y-1">
                <li><strong>Format:</strong> Single round robin (everyone plays everyone once)</li>
                <li><strong>Games per Player:</strong> 5 games each</li>
                <li><strong>Total Games:</strong> 25 games per match</li>
                <li><strong>Match Duration:</strong> Typically 3-4 hours</li>
              </ul>
            </div>

            <div className="bg-muted p-4 rounded-md border border-border">
              <h4 className="font-semibold text-foreground mb-2">Example Match Night:</h4>
              <p className="text-sm text-foreground mb-3">
                Team A sends 5 players, Team B sends 5 players (10 total shooters).
              </p>
              <p className="text-sm text-foreground">
                Each player from Team A plays one game against each player from Team B.
                With 5 opponents, each player shoots 5 games total, resulting in 25 games per match.
              </p>
            </div>
          </div>
        </Card>

        {/* Handicap System */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-4">BCA Standard Handicap System</h2>

          <div className="space-y-4">
            <p className="text-foreground">
              The 8-man format uses the BCA standard handicap system with skill levels typically ranging
              from 2 to 7, based on demonstrated ability and performance.
            </p>

            <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
              <p className="font-semibold text-yellow-900 mb-2">Traditional Approach:</p>
              <p className="text-sm text-yellow-800">
                Skill levels are often assigned based on observation and adjusted manually by the league operator
                or handicap committee. This can lead to subjective decisions and occasional disputes about fair ratings.
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
              <p className="font-semibold text-blue-900 mb-2">BCA Handicap Tables:</p>
              <p className="text-sm text-blue-800">
                Pre-calculated tables determine how many games are needed to win based on the skill level
                difference between players. These tables are standardized across BCA leagues.
              </p>
            </div>
          </div>
        </Card>

        {/* Who This Format Works For */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-4">Who This Format Works For</h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Best Suited For:</h3>
              <ul className="list-disc ml-5 text-foreground space-y-2">
                <li><strong>Established Leagues:</strong> Players already familiar with BCA format and expectations</li>
                <li><strong>Large Player Pools:</strong> Venues with enough players to support 8+ person rosters</li>
                <li><strong>Traditional Players:</strong> Those who prefer the familiar BCA standard approach</li>
                <li><strong>Slower-Paced Environments:</strong> Venues where 3-4 hour matches fit the schedule</li>
              </ul>
            </div>

            <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 mt-4">
              <h4 className="font-semibold text-yellow-900 mb-2">Considerations:</h4>
              <ul className="list-disc ml-5 text-sm text-yellow-800 space-y-1">
                <li>Harder to recruit full rosters (need 8+ committed players per team)</li>
                <li>More crowding around tables (10-16 people when full rosters show up)</li>
                <li>Longer time commitment per match night</li>
                <li>Less playing time per person (5 games vs 6 games in 5-man format)</li>
                <li>Potential for more handicap disputes with manual adjustments</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Navigation Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <Button
            variant="default"
            loadingText="none"
            onClick={() => navigate('/5-man-format-details')}
            size="lg"
          >
            View 5-Man Format Details
          </Button>
          <Button
            variant="default"
            loadingText="none"
            onClick={() => navigate('/format-comparison')}
            size="lg"
          >
            Compare 5-Man vs 8-Man
          </Button>
        </div>
      </div>
    </div>
  );
};
