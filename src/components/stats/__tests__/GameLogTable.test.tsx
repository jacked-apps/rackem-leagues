/**
 * @fileoverview Tests for the virtualised game log.
 *
 * Virtualisation needs a viewport with a real size, and a test DOM reports
 * every element as 0×0 — so without the measurement stubs below the list
 * renders nothing at all and every assertion fails for the wrong reason.
 * That is also why these assertions live here rather than in the page test:
 * the page has no business knowing how the log measures itself.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { GameLogTable } from '../GameLogTable';
import type { PlayerGameRow } from '@/stats/playerGameRow';

// Saved so they can be put back. These are PROTOTYPE-wide overrides: vitest
// runs several test files per worker process, so leaving them in place makes
// every later file believe every element is 900x600. That is not a subtle
// difference — it broke seven unrelated tests in other files, which passed
// individually and failed in a full run, the most expensive kind of failure to
// diagnose.
const originalGetRect = HTMLElement.prototype.getBoundingClientRect;
const originalOffsetHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetHeight'
);
const originalOffsetWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetWidth'
);

beforeAll(() => {
  // Give every element a size, so the virtualiser has a viewport to fill.
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    value: 600,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    value: 900,
  });
  HTMLElement.prototype.getBoundingClientRect = function () {
    return {
      width: 900,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };
});

afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = originalGetRect;
  if (originalOffsetHeight) {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
  } else {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetHeight;
  }
  if (originalOffsetWidth) {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
  } else {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetWidth;
  }
});

function row(i: number, overrides: Partial<PlayerGameRow> = {}): PlayerGameRow {
  return {
    gameId: `g${i}`,
    matchId: 'm1',
    gameNumber: i,
    playedOn: '2026-05-01',
    seasonId: 's1',
    won: i % 2 === 0,
    ending: 'break_and_run',
    gameType: 'eight_ball',
    opponentId: 'opp',
    opponentName: 'Joe Smith',
    opponentHandicap: 620,
    handicapSystem: 'fargo',
    venueName: 'Butera Billiards',
    tableNumber: 2,
    tableSize: 'bar_box',
    myTeamId: 'team-1',
    ...overrides,
  };
}

describe('GameLogTable — content', () => {
  it('shows each game with its context', () => {
    renderWithProviders(<GameLogTable rows={[row(1)]} />);
    expect(screen.getByText('Joe Smith')).toBeInTheDocument();
    expect(screen.getByText(/Butera Billiards/)).toBeInTheDocument();
    expect(screen.getByText('620 (fargo)')).toBeInTheDocument();
    expect(screen.getByText('Break & run')).toBeInTheDocument();
  });

  it('states the result in words, not by colour alone', () => {
    // Colour-blind readers have to be able to read this column.
    renderWithProviders(<GameLogTable rows={[row(1, { won: true }), row(2, { won: false })]} />);
    expect(screen.getByText('Won')).toBeInTheDocument();
    expect(screen.getByText('Lost')).toBeInTheDocument();
  });

  it('shows a dash rather than a blank when a handicap was not recorded', () => {
    renderWithProviders(
      <GameLogTable rows={[row(1, { opponentHandicap: null })]} />
    );
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('says so when there is nothing to list', () => {
    renderWithProviders(<GameLogTable rows={[]} />);
    expect(screen.getByText(/no games to show/i)).toBeInTheDocument();
  });

  it('counts every game in the heading, not just the rendered ones', () => {
    const rows = Array.from({ length: 500 }, (_, i) => row(i));
    renderWithProviders(<GameLogTable rows={rows} />);
    expect(screen.getByText('Every game (500)')).toBeInTheDocument();
  });
});

describe('GameLogTable — virtualisation', () => {
  it('renders a small window of a long list, not all of it', () => {
    // The point of the exercise: 5,000 games must not become 5,000 DOM rows,
    // or scrolling stutters and the page feels slow no matter how fast the
    // filtering is.
    const rows = Array.from({ length: 5000 }, (_, i) => row(i));
    const { container } = renderWithProviders(<GameLogTable rows={rows} />);

    const rendered = container.querySelectorAll('[role="row"][aria-rowindex]');
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(100);
  });

  it('tells assistive tech the real total, not the rendered count', () => {
    const rows = Array.from({ length: 5000 }, (_, i) => row(i));
    const { container } = renderWithProviders(<GameLogTable rows={rows} />);
    expect(container.querySelector('[role="table"]')).toHaveAttribute(
      'aria-rowcount',
      '5000'
    );
  });

  it('renders every row when the list is short', () => {
    const rows = Array.from({ length: 3 }, (_, i) => row(i));
    const { container } = renderWithProviders(<GameLogTable rows={rows} />);
    expect(container.querySelectorAll('[role="row"][aria-rowindex]')).toHaveLength(3);
  });
});
