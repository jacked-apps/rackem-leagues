/**
 * @fileoverview Workshops — the building's home page.
 *
 * The user-facing entry to the building. Lists each available workshop. As
 * new workshops ship (threshold workshop, win-calculator workshop, the
 * eventual Scoring System workshop that assembles modules into a complete
 * system, etc.) they get added to `WORKSHOPS` below and surface here
 * automatically.
 *
 * Framing: the building houses individual MODULE workshops. The future
 * Scoring System workshop is itself one of the workshops — it lets an LO
 * grab a scoring system and edit all of its module slots in one place
 * (which is what makes it a *Scoring System* workshop rather than a single
 * module workshop). Today the building is just the per-game allocator and
 * trigger workshops.
 */

import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Workshop {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly route: string;
  readonly status: 'live' | 'planned';
}

/**
 * Workshop registry. Add a new entry when a new workshop ships.
 *
 * `status: 'planned'` renders the workshop as a disabled placeholder so
 * the building's structure is visible even before the workshop is built —
 * that surfaces what's coming next and where it'll live.
 */
const WORKSHOPS: readonly Workshop[] = [
  {
    key: 'per-game-allocator',
    name: 'Per-Game Allocator',
    description:
      'Build variations of how points are awarded per game. The first workshop in the building.',
    route: '/operator/scoring-workshop/per-game-allocator',
    status: 'live',
  },
  {
    key: 'trigger',
    name: 'Trigger',
    description:
      'Build standalone trigger variations — match-start credits, mid-match bonuses, end-of-match awards.',
    route: '/operator/scoring-workshop/trigger',
    status: 'live',
  },
  {
    key: 'threshold',
    name: 'Threshold',
    description:
      'Build threshold variations — finish lines, head starts, milestones. A threshold figures out one number from the handicaps.',
    route: '/operator/scoring-workshop/threshold',
    status: 'live',
  },
  // Future workshops land here:
  // { key: 'win-calculator', name: 'Win Calculator', ..., status: 'planned' },
  // { key: 'handicap-mechanism', name: 'Handicap Mechanism', ..., status: 'planned' },
  // { key: 'scoring-system', name: 'Scoring System', ..., status: 'planned' }, // the assembly workshop
];

export default function WorkshopHomePage() {
  return (
    <div className="container mx-auto space-y-6 p-4">
      <PageHeader
        title="Workshops"
        subtitle="One workshop per module type. The building blocks of a Scoring System — plus, eventually, the Scoring System workshop itself."
      />
      <div className="space-y-3">
        {WORKSHOPS.map((workshop) => (
          <Card key={workshop.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {workshop.name}
                {workshop.status === 'planned' && (
                  <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                    Planned
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">{workshop.description}</p>
              {workshop.status === 'live' ? (
                <Link to={workshop.route}>
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
