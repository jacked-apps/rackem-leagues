/**
 * @fileoverview Tests for filter options and their counts.
 *
 * The bug these exist for: with Fargo selected, the opponent list still showed
 * "Billy (22)" — his total across the whole history — and picking him returned
 * nothing, because none of those 22 were Fargo games. A count that does not
 * predict its own result is worse than no count at all.
 */

import { describe, it, expect } from 'vitest';
import { buildFilterOptions } from './filterOptions';
import { NO_FILTER } from './gameFilters';
import type { PlayerGameRow } from './playerGameRow';

let seq = 0;

function row(overrides: Partial<PlayerGameRow> = {}): PlayerGameRow {
  seq += 1;
  return {
    gameId: `g${seq}`,
    matchId: 'm1',
    gameNumber: seq,
    playedOn: '2026-05-01',
    seasonId: 'season-1',
    won: true,
    ending: 'plain',
    gameType: 'eight_ball',
    opponentId: 'billy',
    opponentName: 'Billy',
    opponentHandicap: 2,
    handicapSystem: 'points',
    venueName: 'Hall A',
    tableNumber: 1,
    tableSize: 'bar_box',
    myTeamId: 'team-1',
    ...overrides,
  };
}

/**
 * Billy plays only points games; Sam plays only fargo. So "Billy" must not be
 * offered — or must be offered as 0 — once fargo is selected.
 */
const HISTORY: PlayerGameRow[] = [
  ...Array.from({ length: 3 }, () =>
    row({ opponentId: 'billy', opponentName: 'Billy', handicapSystem: 'points' })
  ),
  ...Array.from({ length: 2 }, () =>
    row({ opponentId: 'sam', opponentName: 'Sam', handicapSystem: 'fargo' })
  ),
];

describe('buildFilterOptions - unfiltered', () => {
  it('counts everything when nothing is selected', () => {
    const options = buildFilterOptions(HISTORY, NO_FILTER);
    const billy = options.opponents.find((o) => o.value === 'billy');
    expect(billy?.count).toBe(3);
    expect(options.handicapSystems.map((o) => o.value).sort()).toEqual(['fargo', 'points']);
  });

  it('derives options from the data, never a fixed list', () => {
    const options = buildFilterOptions(HISTORY, NO_FILTER);
    // Only the systems this player has actually played under — no menu of
    // every system the app supports.
    expect(options.handicapSystems.map((o) => o.value).sort()).toEqual([
      'fargo',
      'points',
    ]);
    // And nothing at all for game type, since every game here is 8-ball: a
    // dimension with one value is a fact, not a choice.
    expect(options.gameTypes).toEqual([]);
  });
});

describe('buildFilterOptions - counts respect the OTHER filters', () => {
  it('drops an opponent who has no games in the selected system', () => {
    // The reported bug: Billy was still listed with his full-history count.
    const options = buildFilterOptions(HISTORY, {
      ...NO_FILTER,
      handicapSystem: 'fargo',
    });
    expect(options.opponents.find((o) => o.value === 'billy')).toBeUndefined();
    expect(options.opponents.find((o) => o.value === 'sam')?.count).toBe(2);
  });

  it('every listed count is what picking it would actually return', () => {
    const filter = { ...NO_FILTER, handicapSystem: 'points' };
    const options = buildFilterOptions(HISTORY, filter);
    for (const option of options.opponents) {
      const matching = HISTORY.filter(
        (r) => r.handicapSystem === 'points' && r.opponentId === option.value
      );
      expect(option.count).toBe(matching.length);
    }
  });

  it('a control ignores its OWN selection, so it stays changeable', () => {
    // With Billy selected, the opponent list must still offer Sam — otherwise
    // there is no way to switch opponents without clearing first.
    const options = buildFilterOptions(HISTORY, { ...NO_FILTER, opponentId: 'billy' });
    expect(options.opponents.map((o) => o.value).sort()).toEqual(['billy', 'sam']);
  });

  it('narrows other controls in response to a selection', () => {
    // Selecting Billy leaves only points games, so fargo should disappear from
    // the system control.
    const options = buildFilterOptions(HISTORY, { ...NO_FILTER, opponentId: 'billy' });
    expect(options.handicapSystems.map((o) => o.value)).toEqual(['points']);
  });
});

describe('buildFilterOptions - the selected option stays visible', () => {
  it('keeps a now-impossible selection listed as 0 rather than vanishing', () => {
    // Billy chosen first, then fargo. Billy has no fargo games — but dropping
    // him from his own control would leave it blank with nothing to undo.
    const options = buildFilterOptions(HISTORY, {
      ...NO_FILTER,
      opponentId: 'billy',
      handicapSystem: 'fargo',
    });
    const billy = options.opponents.find((o) => o.value === 'billy');
    expect(billy).toBeDefined();
    expect(billy?.count).toBe(0);
  });

  it('does the same for a venue that no longer matches', () => {
    const history = [
      row({ venueName: 'Hall A', handicapSystem: 'points' }),
      row({ venueName: 'Hall B', handicapSystem: 'fargo' }),
    ];
    const options = buildFilterOptions(history, {
      ...NO_FILTER,
      venueName: 'Hall A',
      handicapSystem: 'fargo',
    });
    expect(options.venues.find((o) => o.value === 'Hall A')?.count).toBe(0);
  });
});

describe('buildFilterOptions - the handicap band', () => {
  it('relaxes both ends together, so the whole scale stays visible', () => {
    // Counting "from" against the current "to" would hide the upper half and
    // make widening a band impossible.
    const history = [
      row({ opponentHandicap: 1 }),
      row({ opponentHandicap: 5 }),
      row({ opponentHandicap: 9 }),
    ];
    const options = buildFilterOptions(history, {
      ...NO_FILTER,
      opponentHandicapMin: 5,
      opponentHandicapMax: 5,
    });
    expect(options.handicaps.map((o) => o.value)).toEqual([1, 5, 9]);
  });

  it('still respects filters from other dimensions', () => {
    const history = [
      row({ opponentHandicap: 1, handicapSystem: 'points' }),
      row({ opponentHandicap: 600, handicapSystem: 'fargo' }),
    ];
    const options = buildFilterOptions(history, { ...NO_FILTER, handicapSystem: 'fargo' });
    expect(options.handicaps.map((o) => o.value)).toEqual([600]);
  });
});

describe('buildFilterOptions - controls that could never help are omitted', () => {
  it('offers nothing for a dimension with a single value across all history', () => {
    // One venue is a fact about this player, not a choice they can make.
    const history = [row({ venueName: 'Hall A' }), row({ venueName: 'Hall A' })];
    expect(buildFilterOptions(history, NO_FILTER).venues).toEqual([]);
  });

  it('still offers a dimension narrowed to one option BY another filter', () => {
    // Two game types exist overall, but only 9-ball is played under fargo.
    // The control must stay available, or it appears to break as you filter —
    // and there would be no way to widen back from it.
    const history = [
      row({ gameType: 'eight_ball', handicapSystem: 'points' }),
      row({ gameType: 'nine_ball', handicapSystem: 'fargo' }),
    ];
    const options = buildFilterOptions(history, {
      ...NO_FILTER,
      handicapSystem: 'fargo',
    });
    expect(options.gameTypes.map((o) => o.value)).toEqual(['nine_ball']);
  });

  it('keeps a dimension available once it has two values anywhere in history', () => {
    const history = [row({ tableNumber: 1 }), row({ tableNumber: 2 })];
    expect(buildFilterOptions(history, NO_FILTER).tables).toHaveLength(2);
  });
});
