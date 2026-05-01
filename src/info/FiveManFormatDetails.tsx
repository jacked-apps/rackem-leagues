/**
 * @fileoverview Detailed 5-Man Team Format Explanation Page
 * Comprehensive guide to the 5-man team format and handicap system
 * Accessible to operators considering this format for their league
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const FiveManFormatDetails: React.FC = () => {
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
            5-Man Team Format: Complete Guide
          </h1>
          <p className="text-xl text-muted-foreground">
            Everything you need to know about the 5-man team format and custom handicap system
          </p>
        </div>

        {/* Overview */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-4">Overview</h2>
          <p className="text-foreground mb-4">
            The 5-man team format is a modern approach to league pool that prioritizes player experience,
            faster matches, and fair competition through an innovative handicap system.
          </p>
          <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
            <p className="font-semibold text-blue-900">Key Benefits:</p>
            <ul className="list-disc ml-5 mt-2 text-blue-800">
              <li>Matches finish 28% faster (2-2.5 hours vs 3-4 hours)</li>
              <li>More playing time per person (6 games vs 5 games)</li>
              <li>Less crowded tables (6 shooters vs 10 shooters)</li>
              <li>Easier team management (smaller rosters)</li>
              <li>Strong defense against sandbagging</li>
              <li>Significantly fewer handicap complaints</li>
            </ul>
          </div>

          <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 mt-4">
            <p className="text-sm text-yellow-900 mb-2">
              <strong>We know this is a lot to read.</strong> This system was designed by a league operator with 15 years
              of experience running leagues and extensive playing experience in both traditional BCA and APA formats.
            </p>
            <p className="text-sm text-yellow-800">
              We believe this is by far the best system available - more fair than traditional BCA while still
              weighted toward higher skilled players (unlike APA). Every detail has been refined through real-world
              experience to create the fairest, most enjoyable league format possible.
            </p>
          </div>
        </Card>

        {/* How It Works */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-4">How It Works</h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Team Structure</h3>
              <ul className="list-disc ml-5 text-foreground space-y-1">
                <li><strong>Roster Size:</strong> 5 total players per team</li>
                <li><strong>Active Players:</strong> 3 players compete on match night</li>
                <li><strong>Flexibility:</strong> Rotate which 3 players compete each week</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Match Format</h3>
              <ul className="list-disc ml-5 text-foreground space-y-1">
                <li><strong>Format:</strong> Double round robin (everyone plays everyone twice)</li>
                <li><strong>Games per Player:</strong> 6 games each</li>
                <li><strong>Total Games:</strong> 18 games per match</li>
                <li><strong>Match Duration:</strong> Typically 2-2.5 hours</li>
              </ul>
            </div>

            <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
              <h4 className="font-semibold text-yellow-900 mb-2">Important: All 18 Games Are Played</h4>
              <p className="text-sm text-yellow-800">
                All 18 games are played to completion regardless of when a team clinches victory.
                This ensures every player's performance is tracked for accurate handicap calculations.
              </p>
            </div>

            <div className="bg-muted p-4 rounded-md border border-border">
              <h4 className="font-semibold text-foreground mb-2">Example Match Night:</h4>
              <p className="text-sm text-foreground mb-3">
                Team A sends players Alice, Bob, and Charlie.<br />
                Team B sends players Dana, Emma, and Frank.
              </p>
              <p className="text-sm text-foreground mb-2">
                <strong>How it flows:</strong> All players play simultaneously in each round, then rotate to next opponent.
                Each matchup happens twice - once with each player breaking.
              </p>
              <div className="text-sm text-foreground space-y-2">
                <p><strong>Game Order (18 games total):</strong></p>
                <div className="ml-4 space-y-3">
                  <div>
                    <p className="font-semibold">Round 1 (all play at once):</p>
                    <ul className="ml-4">
                      <li>Game 1: Alice (break) vs Dana</li>
                      <li>Game 2: Bob (break) vs Emma</li>
                      <li>Game 3: Charlie (break) vs Frank</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold">Round 2 (rotate opponents, switch break):</p>
                    <ul className="ml-4">
                      <li>Game 4: Alice (rack) vs Emma</li>
                      <li>Game 5: Bob (rack) vs Frank</li>
                      <li>Game 6: Charlie (rack) vs Dana</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold">Round 3 continues...</p>
                    <ul className="ml-4">
                      <li>Game 7: Alice (break) vs Frank</li>
                      <li>Game 8: Bob (break) vs Dana</li>
                      <li>Game 9: Charlie (break) vs Emma</li>
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground italic">
                    Pattern repeats - same matchups, but the break swaps. Rounds 4-6 mirror rounds 1-3 with opposite player breaking.
                  </p>
                </div>
                <p className="font-semibold mt-3">Each player shoots 6 games total (3 opponents × 2 games each)</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Handicap System */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-4">Handicap System Explained</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Individual Skill Levels</h3>
              <p className="text-foreground mb-3">
                Each player is assigned a skill level ranging from +2 (strongest) to -2 (developing):
              </p>
              <div className="bg-muted p-4 rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2">Skill Level</th>
                      <th className="text-left py-2">Player Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="py-2 font-mono">+2</td>
                      <td className="py-2">Advanced player - high win percentage</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">+1</td>
                      <td className="py-2">Strong player - above average</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">0</td>
                      <td className="py-2">Average player - balanced record</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">-1</td>
                      <td className="py-2">Developing player - below average</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">-2</td>
                      <td className="py-2">New player - learning the game</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Skill Level Calculation</h3>

              <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                <p className="font-mono text-center text-lg mb-2">
                  Skill Level = (Wins - Losses) ÷ Weeks Played
                </p>
                <p className="text-sm text-foreground text-center">
                  This formula automatically adjusts based on actual performance
                </p>
              </div>

              <div className="mt-4 space-y-3">
                <div className="bg-muted p-3 rounded-md border border-border">
                  <p className="font-semibold text-foreground mb-1">Example 1: Strong Player</p>
                  <p className="text-sm text-foreground">
                    After 10 weeks: 45 wins, 15 losses<br />
                    Skill Level = (45 - 15) ÷ 10 = <strong>+3.0 → capped at +2</strong>
                  </p>
                </div>

                <div className="bg-muted p-3 rounded-md border border-border">
                  <p className="font-semibold text-foreground mb-1">Example 2: Slightly Above Average Player</p>
                  <p className="text-sm text-foreground">
                    After 10 weeks: 33 wins, 27 losses<br />
                    Skill Level = (33 - 27) ÷ 10 = <strong>+0.6 → rounds up to +1</strong>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    Note: Skill levels round to nearest whole number (standard rounding)
                  </p>
                </div>

                <div className="bg-muted p-3 rounded-md border border-border">
                  <p className="font-semibold text-foreground mb-1">Example 3: Developing Player</p>
                  <p className="text-sm text-foreground">
                    After 10 weeks: 21 wins, 36 losses<br />
                    Skill Level = (21 - 36) ÷ 10 = <strong>-1.5 → rounds down to -2</strong>
                  </p>
                </div>

                <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 mt-4">
                  <p className="font-semibold text-yellow-900 mb-2">Starting Skill Level</p>
                  <p className="text-sm text-yellow-800">
                    All players start as <strong>skill level 0</strong> and remain at 0 for their first 3 matches (18 games).
                    After week 3, their skill level is calculated based on actual performance.
                  </p>
                  <p className="text-xs text-yellow-700 mt-2 italic">
                    * Exception: Operators can manually adjust the starting skill level for players who are known to be
                    highly skilled or very unskilled. This manual override only applies for the first 3 weeks.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Team Handicap Calculation</h3>
              <p className="text-foreground mb-3">
                The team handicap for each match is calculated by combining individual skill levels
                with a team modifier based on standings:
              </p>
              <div className="bg-blue-50 p-4 rounded-md border border-blue-200 mb-4">
                <p className="font-mono text-center text-lg mb-2">
                  Team Handicap = (Player 1 + Player 2 + Player 3) + Team Modifier
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Team Modifier (Home Team Only)</h4>
                  <p className="text-sm text-foreground mb-3">
                    The team modifier is applied to the <strong>home team</strong> based on the difference in wins between
                    the home and away teams in the standings. For every 2-win advantage the home team has over the away team,
                    they receive a +1 modifier. If the home team is behind, they receive a negative modifier.
                  </p>

                  <div className="bg-muted p-3 rounded-md border border-border mb-3">
                    <p className="font-semibold text-foreground mb-2">Example Standings (after 10 weeks):</p>
                    <ul className="text-sm text-foreground space-y-1 ml-4">
                      <li>Team A: 8 wins, 2 losses</li>
                      <li>Team B: 7 wins, 3 losses</li>
                      <li>Team C: 5 wins, 5 losses</li>
                      <li>Team D: 4 wins, 6 losses</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold text-foreground">Team Modifier Examples:</p>

                    <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                      <p className="text-sm text-foreground">
                        <strong>Team A (home) vs Team B (away):</strong><br />
                        Win difference: 8 - 7 = 1 win ahead<br />
                        Modifier: <strong>0</strong> (need 2+ wins for a modifier)
                      </p>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                      <p className="text-sm text-foreground">
                        <strong>Team A (home) vs Team C (away):</strong><br />
                        Win difference: 8 - 5 = 3 wins ahead<br />
                        Modifier: <strong>+1</strong> (3 wins ÷ 2 = 1.5 → rounds down to +1)
                      </p>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                      <p className="text-sm text-foreground">
                        <strong>Team A (home) vs Team D (away):</strong><br />
                        Win difference: 8 - 4 = 4 wins ahead<br />
                        Modifier: <strong>+2</strong> (4 wins ÷ 2 = +2)
                      </p>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                      <p className="text-sm text-foreground">
                        <strong>Team D (home) vs Team B (away):</strong><br />
                        Win difference: 4 - 7 = 3 wins behind<br />
                        Modifier: <strong>-1</strong> (home team is worse, gets negative modifier)
                      </p>
                    </div>

                    <div className="bg-green-50 p-3 rounded-md border border-green-200 mt-4">
                      <p className="font-semibold text-green-900 mb-1">Why This Matters:</p>
                      <p className="text-sm text-green-800">
                        This system keeps the standings competitive throughout the season. It prevents runaway leaders from
                        dominating unchallenged and ensures teams at the top must continue playing their best. Lower-ranked
                        teams get a fair chance to climb back up, maintaining excitement and engagement for all teams until
                        the final week.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Determining Games Needed to Win</h3>

              {/* Two column layout: 2/3 text, 1/3 chart */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left column - Example Calculation (2/3 width) */}
                <div className="lg:col-span-2 bg-blue-50 p-4 rounded-md border border-blue-200">
                  <p className="font-semibold text-foreground mb-3 text-base">Example Calculation:</p>

                  <div className="space-y-3">
                    <div>
                      <p className="font-semibold text-foreground">Team A (home team):</p>
                      <p className="text-foreground ml-4">
                        Player 1: +1, Player 2: +1, Player 3: +2 = +4<br />
                        Team Modifier: +2 (home team 4 wins ahead in standings)<br />
                        <strong>Team A Total Handicap: +6</strong>
                      </p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">Team B (away team):</p>
                      <p className="text-foreground ml-4">
                        Player 1: 0, Player 2: -1, Player 3: +1 = 0<br />
                        Team Modifier: 0 (away team gets no modifier)<br />
                        <strong>Team B Total Handicap: 0</strong>
                      </p>
                    </div>

                    <div className="pt-2 border-t border-blue-300">
                      <p className="text-foreground mb-2">
                        <strong>Handicap Difference:</strong><br />
                        Team A: 6 - 0 = <strong className="text-xl">+6</strong><br />
                        Team B: 0 - 6 = <strong className="text-xl">-6</strong>
                      </p>
                    </div>

                    <div className="bg-card p-3 rounded-md">
                      <p className="text-foreground font-semibold mb-2">Looking at the chart:</p>
                      <div className="space-y-2">
                        <div>
                          <p className="text-foreground"><strong>Team A (H/C +6):</strong></p>
                          <p className="text-foreground ml-4">Needs 13 games to win, 12 games to tie</p>
                        </div>
                        <div>
                          <p className="text-foreground"><strong>Team B (H/C -6):</strong></p>
                          <p className="text-foreground ml-4">Needs 7 games to win, 6 games to tie</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3 italic">
                        Note: Tie numbers add up to 18 total games (12 + 6 = 18)
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-blue-800 mt-3 font-medium italic">
                    Both teams have a realistic path to victory - keeping matches competitive and engaging.
                  </p>
                </div>

                {/* Right column - Chart (1/3 width) */}
                <div className="bg-muted p-3 rounded-md border border-border">
                  <div className="mb-2">
                    <p className="font-semibold text-foreground text-base">Games Needed Chart:</p>
                    <p className="text-xs text-muted-foreground">18-game match</p>
                  </div>
                  <div className="flex justify-center">
                    <table className="text-sm border-collapse">
                      <thead>
                        <tr className="border-b-2 border-gray-400">
                          <th className="text-center py-2 px-1 bg-accent">H/C</th>
                          <th className="text-center py-2 px-1 bg-green-100">Win</th>
                          <th className="text-center py-2 px-1 bg-yellow-100">Tie</th>
                          <th className="text-center py-2 px-1 bg-red-100">Loss</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        <tr><td className="py-1 px-1 text-center font-mono">+12</td><td className="py-1 px-1 text-center">16</td><td className="py-1 px-1 text-center">15</td><td className="py-1 px-1 text-center">14</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">+11</td><td className="py-1 px-1 text-center">15</td><td className="py-1 px-1 text-center">—</td><td className="py-1 px-1 text-center">14</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">+10</td><td className="py-1 px-1 text-center">15</td><td className="py-1 px-1 text-center">14</td><td className="py-1 px-1 text-center">13</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">+9</td><td className="py-1 px-1 text-center">14</td><td className="py-1 px-1 text-center">—</td><td className="py-1 px-1 text-center">13</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">+8</td><td className="py-1 px-1 text-center">14</td><td className="py-1 px-1 text-center">13</td><td className="py-1 px-1 text-center">12</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">+7</td><td className="py-1 px-1 text-center">13</td><td className="py-1 px-1 text-center">—</td><td className="py-1 px-1 text-center">12</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">+6</td><td className="py-1 px-1 text-center">13</td><td className="py-1 px-1 text-center">12</td><td className="py-1 px-1 text-center">11</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">+5</td><td className="py-1 px-1 text-center">12</td><td className="py-1 px-1 text-center">—</td><td className="py-1 px-1 text-center">11</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">+4</td><td className="py-1 px-1 text-center">12</td><td className="py-1 px-1 text-center">11</td><td className="py-1 px-1 text-center">10</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">+3</td><td className="py-1 px-1 text-center">11</td><td className="py-1 px-1 text-center">—</td><td className="py-1 px-1 text-center">10</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">+2</td><td className="py-1 px-1 text-center">11</td><td className="py-1 px-1 text-center">10</td><td className="py-1 px-1 text-center">9</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">+1</td><td className="py-1 px-1 text-center">10</td><td className="py-1 px-1 text-center">—</td><td className="py-1 px-1 text-center">9</td></tr>
                        <tr className="bg-blue-50"><td className="py-1 px-1 text-center font-mono font-bold">0</td><td className="py-1 px-1 text-center font-bold">10</td><td className="py-1 px-1 text-center font-bold">9</td><td className="py-1 px-1 text-center font-bold">8</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">-1</td><td className="py-1 px-1 text-center">9</td><td className="py-1 px-1 text-center">—</td><td className="py-1 px-1 text-center">8</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">-2</td><td className="py-1 px-1 text-center">9</td><td className="py-1 px-1 text-center">8</td><td className="py-1 px-1 text-center">7</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">-3</td><td className="py-1 px-1 text-center">8</td><td className="py-1 px-1 text-center">—</td><td className="py-1 px-1 text-center">7</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">-4</td><td className="py-1 px-1 text-center">8</td><td className="py-1 px-1 text-center">7</td><td className="py-1 px-1 text-center">6</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">-5</td><td className="py-1 px-1 text-center">7</td><td className="py-1 px-1 text-center">—</td><td className="py-1 px-1 text-center">6</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">-6</td><td className="py-1 px-1 text-center">7</td><td className="py-1 px-1 text-center">6</td><td className="py-1 px-1 text-center">5</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">-7</td><td className="py-1 px-1 text-center">6</td><td className="py-1 px-1 text-center">—</td><td className="py-1 px-1 text-center">5</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">-8</td><td className="py-1 px-1 text-center">6</td><td className="py-1 px-1 text-center">5</td><td className="py-1 px-1 text-center">4</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">-9</td><td className="py-1 px-1 text-center">5</td><td className="py-1 px-1 text-center">—</td><td className="py-1 px-1 text-center">4</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">-10</td><td className="py-1 px-1 text-center">5</td><td className="py-1 px-1 text-center">4</td><td className="py-1 px-1 text-center">3</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">-11</td><td className="py-1 px-1 text-center">4</td><td className="py-1 px-1 text-center">—</td><td className="py-1 px-1 text-center">3</td></tr>
                        <tr><td className="py-1 px-1 text-center font-mono">-12</td><td className="py-1 px-1 text-center">4</td><td className="py-1 px-1 text-center">3</td><td className="py-1 px-1 text-center">2</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Odd H/C values have no tie scenario.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Tie-Breaker Playoff */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-4">Tie-Breaker Playoff</h2>

          <div className="space-y-4">
            <p className="text-foreground">
              If the match ends in a tie after all 18 games, one additional round is played to determine the match winner:
            </p>

            <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-3">Playoff Rules:</h4>
              <ul className="list-disc ml-5 text-sm text-blue-800 space-y-2">
                <li>
                  <strong>Best 2 out of 3:</strong> Teams play up to 3 games. First team to win 2 games wins the match.
                  If one team wins the first two games, the third game is not played.
                </li>
                <li>
                  <strong>Player Selection:</strong> Captains may change the player order or substitute different players
                  from their roster for the playoff round.
                </li>
                <li>
                  <strong>Break Advantage:</strong> Home team breaks on the 1st and 3rd games. Away team breaks on the 2nd game.
                </li>
              </ul>
            </div>

            <div className="bg-green-50 p-4 rounded-md border border-green-200">
              <h4 className="font-semibold text-green-900 mb-2">Playoff Handicap Scoring:</h4>
              <p className="text-sm text-green-800 mb-2">
                Playoff results affect player handicaps differently than regular games:
              </p>
              <ul className="list-disc ml-5 text-sm text-green-800 space-y-1">
                <li>
                  <strong>Winning Team:</strong> All 3 players in the playoff each get <strong>+1 win</strong> counted toward their handicap,
                  even if one of them lost their individual game.
                </li>
                <li>
                  <strong>Losing Team:</strong> No wins or losses are counted for any of the 3 playoff players.
                  Their handicaps remain unchanged.
                </li>
              </ul>
              <p className="text-xs text-green-700 mt-3 italic">
                This team-based scoring for playoffs ensures players are incentivized to play their best without being
                individually penalized for a tie-breaker loss.
              </p>
            </div>
          </div>
        </Card>

        {/* Standings and Ranking */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-4">Standings and Ranking</h2>

          <div className="space-y-4">
            <p className="text-foreground">
              Team placement in the standings is determined by a three-tier system that ensures fair and accurate rankings throughout the season:
            </p>

            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">1. Team Match Wins (Primary)</h4>
                <p className="text-sm text-blue-800 mb-2">
                  After each match night, a team either wins or loses the match based on whether they reached their target games.
                  This is the <strong>most important factor</strong> in determining standings.
                </p>
                <p className="text-xs text-blue-700 italic">
                  Example: A team with 8 match wins and 2 match losses is ranked higher than a team with 7 wins and 3 losses,
                  regardless of other factors.
                </p>
              </div>

              <div className="bg-green-50 p-4 rounded-md border border-green-200">
                <h4 className="font-semibold text-green-900 mb-2">2. Team Points (Secondary)</h4>
                <p className="text-sm text-green-800 mb-3">
                  If teams have the same number of match wins, team points are used to break the tie.
                  Points are earned or lost based on performance beyond your target:
                </p>
                <ul className="list-disc ml-5 text-sm text-green-800 space-y-2">
                  <li>
                    <strong>Winning by more than needed:</strong> If you need 12 games to win and you win 14 games,
                    you earn <strong>+2 team points</strong>
                  </li>
                  <li>
                    <strong>Losing by missing your target:</strong> If you need 8 games to win but only win 6 games,
                    you get <strong>-2 team points</strong>
                  </li>
                  <li>
                    <strong>Ties:</strong> Ties always result in <strong>0 team points</strong>, regardless of games won or lost
                  </li>
                </ul>
                <p className="text-xs text-green-700 mt-2 italic">
                  Team points accumulate throughout the season, rewarding dominant performances and penalizing poor showings.
                </p>
              </div>

              <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
                <h4 className="font-semibold text-yellow-900 mb-2">3. Total Games Won (Tie-Breaker)</h4>
                <p className="text-sm text-yellow-800 mb-2">
                  If teams have identical match wins <strong>and</strong> identical team points, the total number of
                  individual games won by all players across the entire season is used as the final tie-breaker.
                </p>
                <p className="text-xs text-yellow-700 italic">
                  Note: This scenario is extremely rare - in 15 years of operation, teams tying on both match wins and
                  team points has only occurred a handful of times. All three categories tying has never been observed.
                </p>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-md border border-border mt-4">
              <h4 className="font-semibold text-foreground mb-3">Example Standings (After 10 Weeks):</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-400">
                    <th className="text-left py-2">Team</th>
                    <th className="text-center py-2">Match W-L</th>
                    <th className="text-center py-2">Team Points</th>
                    <th className="text-center py-2">Total Games</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                  <tr>
                    <td className="py-2 font-medium">Team A</td>
                    <td className="py-2 text-center">8-2</td>
                    <td className="py-2 text-center">+12</td>
                    <td className="py-2 text-center">105</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Team B</td>
                    <td className="py-2 text-center">7-3</td>
                    <td className="py-2 text-center">+8</td>
                    <td className="py-2 text-center">98</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Team C</td>
                    <td className="py-2 text-center">7-3</td>
                    <td className="py-2 text-center">+3</td>
                    <td className="py-2 text-center">94</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Team D</td>
                    <td className="py-2 text-center">5-5</td>
                    <td className="py-2 text-center">-2</td>
                    <td className="py-2 text-center">87</td>
                  </tr>
                  <tr className="border-t-2 border-gray-500">
                    <td className="py-2 text-center text-muted-foreground italic" colSpan={4}>
                      ... additional teams below ...
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-3">
                Team B ranks ahead of Team C because both have 7-3 records, but Team B has more team points (+8 vs +3).
              </p>
            </div>
          </div>
        </Card>

        {/* Anti-Sandbagging Features */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-4">Why This Reduces Handicap Complaints</h2>

          <div className="space-y-4">
            <p className="text-foreground">
              The dynamic handicap system has built-in features that discourage sandbagging and create fairer competition:
            </p>

            <div className="space-y-3">
              <div className="bg-green-50 p-4 rounded-md border border-green-200">
                <h4 className="font-semibold text-green-900 mb-2">✓ Transparent Calculations</h4>
                <p className="text-sm text-green-800">
                  The simple formula (Wins - Losses ÷ Weeks) is easy to understand and verify.
                  Players can see exactly how their handicap is calculated - no mysterious adjustments or subjective decisions.
                </p>
              </div>

              <div className="bg-green-50 p-4 rounded-md border border-green-200">
                <h4 className="font-semibold text-green-900 mb-2">✓ Team Modifier Balancing</h4>
                <p className="text-sm text-green-800">
                  Teams that dominate the standings get a positive modifier that makes it harder to win,
                  while struggling teams get help through negative modifiers. This keeps competition fair
                  and prevents runaway leaders.
                </p>
              </div>

              <div className="bg-green-50 p-4 rounded-md border border-green-200">
                <h4 className="font-semibold text-green-900 mb-2">✓ Every Single Game Matters</h4>
                <p className="text-sm text-green-800">
                  Because the team modifier keeps standings competitive, team points become crucial for ranking.
                  Every game won or lost directly affects team points, which means every game has real impact on your
                  season placement. Players stay engaged and motivated throughout the entire match.
                </p>
              </div>

              <div className="bg-green-50 p-4 rounded-md border border-green-200">
                <h4 className="font-semibold text-green-900 mb-2">✓ Handicap Responsiveness</h4>
                <p className="text-sm text-green-800 mb-2">
                  Skill levels recalculate every week based on actual performance. The system (by default, but adjustable
                  by the operator) counts the most recent 250 games a player has played to calculate their handicap.
                </p>
                <p className="text-sm text-green-800">
                  This amount provides stability - one or two bad nights won't drastically change your handicap - while
                  remaining responsive enough to stay current with a player's actual skill level. Players can't stay at
                  a low handicap if they're winning consistently.
                </p>
              </div>

              <div className="bg-green-50 p-4 rounded-md border border-green-200">
                <h4 className="font-semibold text-green-900 mb-2">✓ Hard to Game</h4>
                <p className="text-sm text-green-800">
                  To maintain a false low handicap, a player would need to lose consistently, which means
                  their team loses and they accumulate negative team points.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Player Experience */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-4">Why Players Prefer This Format</h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">More Action, Less Waiting</h3>
              <p className="text-foreground">
                In traditional 8-man format, players shoot only 5 games and spend much of the night waiting.
                In 5-man format, everyone shoots 6 games in less total time.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Less Crowded Tables</h3>
              <p className="text-foreground">
                With 5-man teams, you have 6-10 people around the tables (when everyone shows up).
                With 8-man teams, it's 10-16 people crowding around. That's a dramatic difference in comfort and space.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Faster Matches = Better Retention</h3>
              <p className="text-foreground">
                Matches that finish in 2-2.5 hours instead of 3-4 hours mean players can have a life outside
                of league night. This is especially important for players with families or early work schedules.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Fairer Competition</h3>
              <p className="text-foreground">
                The dynamic handicap system creates more competitive matches. Players report feeling like
                every match has a real chance, regardless of skill differences.
              </p>
            </div>
          </div>
        </Card>

        {/* For Operators */}
        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-4">Benefits for League Operators</h2>

          <ul className="space-y-3 text-foreground">
            <li className="flex items-start">
              <span className="text-green-600 font-bold mr-2">✓</span>
              <span><strong>Easier Team Building:</strong> Only need 5 players instead of 8+ to field a team</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 font-bold mr-2">✓</span>
              <span><strong>Better Venue Relations:</strong> Shorter matches mean less table time required. Busy venues may rent tables earlier for additional revenue.</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 font-bold mr-2">✓</span>
              <span><strong>Fewer Complaints:</strong> Transparent and robust handicap system reduces disputes</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 font-bold mr-2">✓</span>
              <span><strong>Higher Retention:</strong> Players stay engaged when they play more and wait less</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 font-bold mr-2">✓</span>
              <span><strong>Eliminates Bias:</strong> Operators have no control over individual handicaps (except initial 3-week assignments). Handicaps come directly from each player's record, allowing operators to deflect complaints with "Your handicap reflects your performance - I can't change your record."</span>
            </li>
          </ul>
        </Card>

        {/* Navigation Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <Button
            variant="default"
            loadingText="none"
            onClick={() => navigate('/8-man-format-details')}
            size="lg"
          >
            View 8-Man Format Details
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
