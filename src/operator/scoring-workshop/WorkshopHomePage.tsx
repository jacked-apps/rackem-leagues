/**
 * @fileoverview Scoring System Workshop — the building's home page.
 *
 * The user-facing entry to the building. Lists each available room. As new
 * rooms ship (trigger room, threshold room, win-calculator room, etc.)
 * they get added to `ROOMS` below and surface here automatically.
 *
 * The framing: the workshop is a BUILDING; inside are specialized WORK
 * ROOMS, one per module type. This page is the building's lobby. Each
 * room is its own dedicated page.
 */

import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Room {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly route: string;
  readonly status: 'live' | 'planned';
}

/**
 * Workshop room registry. Add a new entry when a new room ships.
 *
 * `status: 'planned'` renders the room as a disabled placeholder so the
 * building's structure is visible even before the room is built — that
 * surfaces what's coming next and where it'll live.
 */
const ROOMS: readonly Room[] = [
  {
    key: 'per-game-allocator',
    name: 'Per-Game Allocator',
    description:
      'Build variations of how points are awarded per game. The first room of the building.',
    route: '/operator/scoring-workshop/per-game-allocator',
    status: 'live',
  },
  // Future rooms land here:
  // { key: 'trigger', name: 'Trigger', ..., status: 'planned' },
  // { key: 'threshold', name: 'Threshold', ..., status: 'planned' },
  // { key: 'win-calculator', name: 'Win Calculator', ..., status: 'planned' },
  // { key: 'handicap-mechanism', name: 'Handicap Mechanism', ..., status: 'planned' },
];

export default function WorkshopHomePage() {
  return (
    <div className="container mx-auto space-y-6 p-4">
      <PageHeader
        title="Scoring System Workshop"
        subtitle="Build the pieces of a Scoring System. Each room handles one module type."
      />
      <div className="space-y-3">
        {ROOMS.map((room) => (
          <Card key={room.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {room.name}
                {room.status === 'planned' && (
                  <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                    Planned
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">{room.description}</p>
              {room.status === 'live' ? (
                <Link to={room.route}>
                  <Button loadingText="none" size="sm">
                    Open
                  </Button>
                </Link>
              ) : (
                <Button
                  loadingText="none"
                  size="sm"
                  variant="outline"
                  disabled
                >
                  Not yet
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
