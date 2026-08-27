import {describe, expect, it} from 'vitest';

import {
  createMpLobby,
  MP_POWER_COST,
  type MpPlayer,
  type MpState,
  startMp,
} from './multiplayerEngine';
import {chooseAiAction, createAiPlayers} from './versusAi';

const TWO: MpPlayer[] = [
  {id: 'you', name: 'You', color: '#111', host: true, ready: true, joinedAt: 1},
  {id: 'hex', name: 'HEX', color: '#222', host: false, ready: true, joinedAt: 2},
];

const HUNT: MpPlayer[] = [
  {id: 'you', name: 'You', color: '#111', host: true, ready: true, joinedAt: 1},
  {id: 'rom', name: 'ROM', color: '#222', host: false, ready: true, joinedAt: 2},
];

function place(
  players: MpPlayer[],
  patch: (state: MpState) => MpState,
): MpState {
  return patch(startMp(createMpLobby(players, 1)));
}

describe('createAiPlayers', () => {
  it('seats you plus HEX ROM LCD with unique colors', () => {
    const roster = createAiPlayers({name: 'Ann', color: '#2a3816'});
    expect(roster.map((player) => player.id)).toEqual([
      'you',
      'hex',
      'rom',
      'lcd',
    ]);
    expect(new Set(roster.map((player) => player.color)).size).toBe(4);
    expect(roster[0].host).toBe(true);
  });
});

describe('chooseAiAction', () => {
  it('turns away from a wall', () => {
    const state = place(TWO, (playing) => ({
      ...playing,
      foods: [{x: 14, y: 12}],
      snakes: [
        playing.snakes[0],
        {
          ...playing.snakes[1],
          id: 'hex',
          direction: 'left',
          pending: 'left',
          body: [
            {x: 0, y: 10},
            {x: 1, y: 10},
            {x: 2, y: 10},
          ],
        },
      ],
    }));
    expect(chooseAiAction(state, 'hex').dir).not.toBe('left');
  });

  it('walks toward a planted apple', () => {
    const state = place(TWO, (playing) => ({
      ...playing,
      foods: [{x: 10, y: 10}],
      snakes: [
        {
          ...playing.snakes[0],
          body: [
            {x: 20, y: 20},
            {x: 21, y: 20},
            {x: 22, y: 20},
          ],
        },
        {
          ...playing.snakes[1],
          id: 'hex',
          direction: 'right',
          pending: 'right',
          body: [
            {x: 5, y: 10},
            {x: 4, y: 10},
            {x: 3, y: 10},
          ],
        },
      ],
    }));
    expect(chooseAiAction(state, 'hex').dir).toBe('right');
  });

  it('refuses a reverse even if the apple is behind', () => {
    const state = place(TWO, (playing) => ({
      ...playing,
      foods: [{x: 2, y: 10}],
      snakes: [
        playing.snakes[0],
        {
          ...playing.snakes[1],
          id: 'hex',
          direction: 'right',
          pending: 'right',
          body: [
            {x: 5, y: 10},
            {x: 4, y: 10},
            {x: 3, y: 10},
          ],
        },
      ],
    }));
    expect(chooseAiAction(state, 'hex').dir).not.toBe('left');
  });

  it('fires at a lined-up head when charged', () => {
    const state = place(HUNT, (playing) => ({
      ...playing,
      foods: [{x: 0, y: 0}],
      snakes: [
        {
          ...playing.snakes[0],
          direction: 'right',
          pending: 'right',
          body: [
            {x: 7, y: 10},
            {x: 7, y: 11},
            {x: 7, y: 12},
          ],
        },
        {
          ...playing.snakes[1],
          id: 'rom',
          direction: 'right',
          pending: 'right',
          power: MP_POWER_COST,
          body: [
            {x: 5, y: 10},
            {x: 4, y: 10},
            {x: 3, y: 10},
          ],
        },
      ],
    }));
    expect(chooseAiAction(state, 'rom')).toEqual({dir: 'right', fire: true});
  });

  it('fires to eat an apple on the ray', () => {
    const state = place(TWO, (playing) => ({
      ...playing,
      foods: [{x: 7, y: 10}],
      snakes: [
        {
          ...playing.snakes[0],
          body: [
            {x: 20, y: 20},
            {x: 21, y: 20},
            {x: 22, y: 20},
          ],
        },
        {
          ...playing.snakes[1],
          id: 'hex',
          direction: 'right',
          pending: 'right',
          power: MP_POWER_COST,
          body: [
            {x: 5, y: 10},
            {x: 4, y: 10},
            {x: 3, y: 10},
          ],
        },
      ],
    }));
    expect(chooseAiAction(state, 'hex').fire).toBe(true);
  });

  it('does not fire into a body', () => {
    const state = place(HUNT, (playing) => ({
      ...playing,
      foods: [{x: 0, y: 0}],
      snakes: [
        {
          ...playing.snakes[0],
          direction: 'up',
          pending: 'up',
          body: [
            {x: 7, y: 8},
            {x: 7, y: 10},
            {x: 7, y: 11},
          ],
        },
        {
          ...playing.snakes[1],
          id: 'rom',
          direction: 'right',
          pending: 'right',
          power: MP_POWER_COST,
          body: [
            {x: 5, y: 10},
            {x: 4, y: 10},
            {x: 3, y: 10},
          ],
        },
      ],
    }));
    expect(chooseAiAction(state, 'rom').fire).toBe(false);
  });

  it('turns toward a close side apple', () => {
    const state = place(TWO, (playing) => ({
      ...playing,
      foods: [{x: 5, y: 6}],
      snakes: [
        {
          ...playing.snakes[0],
          body: [
            {x: 20, y: 20},
            {x: 21, y: 20},
            {x: 22, y: 20},
          ],
        },
        {
          ...playing.snakes[1],
          id: 'hex',
          direction: 'right',
          pending: 'right',
          body: [
            {x: 5, y: 10},
            {x: 4, y: 10},
            {x: 3, y: 10},
          ],
        },
      ],
    }));
    expect(chooseAiAction(state, 'hex').dir).toBe('up');
  });
});
