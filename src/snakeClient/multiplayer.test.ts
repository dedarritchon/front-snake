import {describe, expect, it} from 'vitest';

import {MP_COLORS, MP_MAX_PLAYERS} from '../game/multiplayerEngine';
import {
  holdRoster,
  PRESENCE_GRACE_MS,
  rosterFromPresence,
} from './multiplayer';

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
    expect(roster[0]).toMatchObject({
      name: 'Ann',
      host: true,
      ready: false,
      joinedAt: 10,
      color: MP_COLORS[0],
    });
    expect(roster[1].color).toBe(MP_COLORS[1]);
  });

  it('reads ready from presence', () => {
    expect(
      rosterFromPresence({
        a: [{playerId: 'a', name: 'Ann', host: true, ready: true, joinedAt: 1}],
        b: [{playerId: 'b', name: 'Bea', host: false, ready: false, joinedAt: 2}],
      }).map((player) => player.ready),
    ).toEqual([true, false]);
  });

  it('skips malformed presence rows', () => {
    expect(
      rosterFromPresence({
        x: [{playerId: 1, name: 'nope'}],
        y: [null],
        z: [{playerId: 'ok', name: 'Ok', host: true, joinedAt: 1}],
      }),
    ).toEqual([
      {
        id: 'ok',
        name: 'Ok',
        color: MP_COLORS[0],
        host: true,
        ready: false,
        joinedAt: 1,
      },
    ]);
  });
});

describe('holdRoster', () => {
  const ann = {
    id: 'a',
    name: 'Ann',
    color: MP_COLORS[0],
    host: true,
    ready: true,
    joinedAt: 1,
  };
  const bea = {
    id: 'b',
    name: 'Bea',
    color: MP_COLORS[1],
    host: false,
    ready: false,
    joinedAt: 2,
  };

  it('keeps a missing player until the grace period ends', () => {
    const missing = new Map<string, number>();
    const held = holdRoster([ann, bea], [ann], 1000, missing);
    expect(held.players.map((player) => player.id)).toEqual(['a', 'b']);
    expect(held.missingSince.get('b')).toBe(1000);

    const dropped = holdRoster(
      held.players,
      [ann],
      1000 + PRESENCE_GRACE_MS,
      held.missingSince,
    );
    expect(dropped.players.map((player) => player.id)).toEqual(['a']);
    expect(dropped.missingSince.has('b')).toBe(false);
  });

  it('restores a player who returns before grace ends', () => {
    const held = holdRoster([ann, bea], [ann], 1000, new Map());
    const back = holdRoster(held.players, [ann, bea], 2000, held.missingSince);
    expect(back.players.map((player) => player.id)).toEqual(['a', 'b']);
    expect(back.missingSince.size).toBe(0);
  });

  it('does not drop everyone on an empty blip', () => {
    const held = holdRoster([ann, bea], [], 1000, new Map());
    expect(held.players.map((player) => player.id)).toEqual(['a', 'b']);
  });
});
