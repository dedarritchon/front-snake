import {describe, expect, it} from 'vitest';

import {MP_COLORS, MP_MAX_PLAYERS} from '../game/multiplayerEngine';
import {rosterFromPresence} from './multiplayer';

describe('rosterFromPresence', () => {
  it('sorts by join time, assigns colors, and caps at four', () => {
    const roster = rosterFromPresence({
      z: [{playerId: 'z', name: 'Zed', host: false, joinedAt: 30}],
      a: [{playerId: 'a', name: 'Ann', host: true, joinedAt: 10}],
      b: [{playerId: 'b', name: 'Bea', host: false, joinedAt: 20}],
      c: [{playerId: 'c', name: 'Cee', host: false, joinedAt: 25}],
      d: [{playerId: 'd', name: 'Dee', host: false, joinedAt: 40}],
    });
    expect(roster).toHaveLength(MP_MAX_PLAYERS);
    expect(roster.map((player) => player.id)).toEqual(['a', 'b', 'c', 'z']);
    expect(roster[0]).toMatchObject({name: 'Ann', host: true, color: MP_COLORS[0]});
    expect(roster[1].color).toBe(MP_COLORS[1]);
  });

  it('skips malformed presence rows', () => {
    expect(
      rosterFromPresence({
        x: [{playerId: 1, name: 'nope'}],
        y: [null],
        z: [{playerId: 'ok', name: 'Ok', host: true, joinedAt: 1}],
      }),
    ).toEqual([
      {id: 'ok', name: 'Ok', color: MP_COLORS[0], host: true},
    ]);
  });
});
