/**
 * @fileoverview Format Comparison Page
 * Side-by-side comparison of 5-Man and 8-Man team formats
 * Helps operators make informed decisions about which format to choose
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const FormatComparison: React.FC = () => {
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
            5-Man vs 8-Man Format Comparison
          </h1>
          <p className="text-xl text-muted-foreground">
            Compare the key differences to choose the right format for your league
          </p>
        </div>

        {/* Comparison Table */}
        <Card className="p-6 mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">Feature Comparison</h2>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left py-3 pr-4">Feature</th>
                  <th className="text-left py-3 px-4 bg-success/10">5-Man Format</th>
                  <th className="text-left py-3 pl-4 bg-muted">8-Man Format</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-3 pr-4 font-medium">Roster Size</td>
                  <td className="py-3 px-4 bg-success/10">5 players</td>
                  <td className="py-3 pl-4 bg-muted">8+ players</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Players Per Night</td>
                  <td className="py-3 px-4 bg-success/10">3 vs 3 (6 total)</td>
                  <td className="py-3 pl-4 bg-muted">5 vs 5 (10 total)</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Games Per Player</td>
                  <td className="py-3 px-4 bg-success/10">6 games</td>
                  <td className="py-3 pl-4 bg-muted">5 games</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Total Games</td>
                  <td className="py-3 px-4 bg-success/10">18 games</td>
                  <td className="py-3 pl-4 bg-muted">25 games</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Match Format</td>
                  <td className="py-3 px-4 bg-success/10">Double round robin</td>
                  <td className="py-3 pl-4 bg-muted">Single round robin</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Match Duration</td>
                  <td className="py-3 px-4 bg-success/10">2-2.5 hours</td>
                  <td className="py-3 pl-4 bg-muted">3-4 hours</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Crowding (Full Rosters)</td>
                  <td className="py-3 px-4 bg-success/10">6-10 people around tables</td>
                  <td className="py-3 pl-4 bg-muted">10-16 people around tables</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Handicap System</td>
                  <td className="py-3 px-4 bg-success/10">Dynamic, auto-adjusting</td>
                  <td className="py-3 pl-4 bg-muted">BCA standard tables</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Handicap Complaints</td>
                  <td className="py-3 px-4 bg-success/10">Minimal</td>
                  <td className="py-3 pl-4 bg-muted">Common</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Team Building Difficulty</td>
                  <td className="py-3 px-4 bg-success/10">Easier (5 players)</td>
                  <td className="py-3 pl-4 bg-muted">Harder (8+ players)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Quick Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6 bg-success/10 border-success/40">
            <h3 className="text-xl font-bold text-success mb-3">5-Man Format</h3>
            <p className="text-sm text-foreground mb-3">Best for:</p>
            <ul className="list-disc ml-5 text-sm text-foreground space-y-1">
              <li>Modern leagues prioritizing player experience</li>
              <li>Venues wanting faster turnaround</li>
              <li>Operators wanting fewer handicap disputes</li>
              <li>Leagues with smaller player pools</li>
              <li>Players with time constraints</li>
            </ul>
          </Card>

          <Card className="p-6 bg-muted border-border">
            <h3 className="text-xl font-bold text-foreground mb-3">8-Man Format</h3>
            <p className="text-sm text-foreground mb-3">Best for:</p>
            <ul className="list-disc ml-5 text-sm text-foreground space-y-1">
              <li>Established leagues with BCA tradition</li>
              <li>Large player pools</li>
              <li>Players familiar with BCA standard</li>
              <li>Venues comfortable with longer matches</li>
              <li>Traditional league environments</li>
            </ul>
          </Card>
        </div>

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
            onClick={() => navigate('/8-man-format-details')}
            size="lg"
          >
            View 8-Man Format Details
          </Button>
        </div>
      </div>
    </div>
  );
};
