import {describe, expect, it} from 'vitest';

import {SCORE_PER_FOOD as SOLO_SCORE} from './engine';
import {
  allReadyToStart,
  createMpLobby,
  createPlayerId,
  createRoomId,
  isRoomId,
  killPlayer,
  markHostLeft,
  MP_GRID_HEIGHT,
  MP_GRID_WIDTH,
  MP_MAX_PLAYERS,
  type MpPlayer,
  normalizeRoomId,
  queueMpInput,
  startMp,
  tickMp,
} from './multiplayerEngine';

const PLAYERS: MpPlayer[] = [
  {id: 'a', name: 'A', color: '#111', host: true, ready: false, joinedAt: 1},
  {id: 'b', name: 'B', color: '#222', host: false, ready: false, joinedAt: 2},
  {id: 'c', name: 'C', color: '#333', host: false, ready: false, joinedAt: 3},
];

describe('multiplayerEngine', () => {
  it('refuses to start with one player', () => {
    const lobby = createMpLobby([PLAYERS[0]], 1);
    expect(startMp(lobby).status).toBe('lobby');
  });

  it('caps the lobby at four snakes', () => {
    const extra: MpPlayer[] = [
      ...PLAYERS,
      {id: 'd', name: 'D', color: '#444', host: false, ready: false, joinedAt: 4},
      {id: 'e', name: 'E', color: '#555', host: false, ready: false, joinedAt: 5},
    ];
    expect(createMpLobby(extra, 1).snakes).toHaveLength(MP_MAX_PLAYERS);
  });

  it('starts two snakes in opposite corners', () => {
    const playing = startMp(createMpLobby(PLAYERS.slice(0, 2), 9));
    expect(playing.status).toBe('playing');
    expect(playing.snakes).toHaveLength(2);
    expect(playing.foods.length).toBeGreaterThan(0);
    expect(playing.gridWidth).toBe(MP_GRID_WIDTH);
    expect(playing.gridHeight).toBe(MP_GRID_HEIGHT);
    expect(playing.snakes[0].body[0]).toEqual({x: 2, y: 3});
    expect(playing.snakes[1].body[0]).toEqual({x: MP_GRID_WIDTH - 3, y: 3});
  });

  it('ignores a reverse input and lobby input', () => {
    const lobby = createMpLobby(PLAYERS.slice(0, 2), 3);
    expect(queueMpInput(lobby, 'a', 'down').snakes[0].pending).toBe('right');
    let state = startMp(lobby);
    state = queueMpInput(state, 'a', 'left');
    expect(state.snakes[0].pending).toBe('right');
    state = queueMpInput(state, 'a', 'down');
    expect(state.snakes[0].pending).toBe('down');
  });

  it('does not tick in the lobby', () => {
    const lobby = createMpLobby(PLAYERS.slice(0, 2), 1);
    expect(tickMp(lobby)).toBe(lobby);
  });

  it('grows a snake that eats', () => {
    let state = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    const head = state.snakes[0].body[0];
    const bait = {x: head.x + 1, y: head.y};
    state = {
      ...state,
      foods: [bait],
      snakes: [
        {...state.snakes[0], direction: 'right', pending: 'right'},
        state.snakes[1],
      ],
    };
    const length = state.snakes[0].body.length;
    state = tickMp(state);
    expect(state.snakes[0].score).toBe(SOLO_SCORE);
    expect(state.snakes[0].body).toHaveLength(length + 1);
    expect(state.status).toBe('playing');
  });

  it('kills a snake that hits a wall and continues if others remain', () => {
    let state = startMp(createMpLobby(PLAYERS, 1));
    state = {
      ...state,
      foods: [{x: 9, y: 18}],
      snakes: [
        {
          ...state.snakes[0],
          direction: 'left',
          pending: 'left',
          body: [
            {x: 0, y: 10},
            {x: 1, y: 10},
            {x: 2, y: 10},
          ],
        },
        state.snakes[1],
        state.snakes[2],
      ],
    };
    state = tickMp(state);
    expect(state.snakes[0].alive).toBe(false);
    expect(state.status).toBe('playing');
    expect(state.snakes.filter((snake) => snake.alive)).toHaveLength(2);
  });

  it('kills a snake that runs into another body', () => {
    let state = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    state = {
      ...state,
      foods: [{x: 0, y: 0}],
      snakes: [
        {
          ...state.snakes[0],
          direction: 'right',
          pending: 'right',
          body: [
            {x: 5, y: 10},
            {x: 4, y: 10},
            {x: 3, y: 10},
          ],
        },
        {
          ...state.snakes[1],
          direction: 'right',
          pending: 'right',
          body: [
            {x: 7, y: 10},
            {x: 6, y: 10},
            {x: 5, y: 10},
          ],
        },
      ],
    };
    state = tickMp(state);
    expect(state.snakes[0].alive).toBe(false);
    expect(state.snakes[1].alive).toBe(true);
    expect(state.status).toBe('over');
    expect(state.winnerId).toBe('b');
  });

  it('declares a draw when the last two heads share a cell', () => {
    let state = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    state = {
      ...state,
      foods: [{x: 0, y: 0}],
      snakes: [
        {
          ...state.snakes[0],
          direction: 'right',
          pending: 'right',
          body: [
            {x: 5, y: 10},
            {x: 4, y: 10},
            {x: 3, y: 10},
          ],
        },
        {
          ...state.snakes[1],
          direction: 'left',
          pending: 'left',
          body: [
            {x: 7, y: 10},
            {x: 8, y: 10},
            {x: 9, y: 10},
          ],
        },
      ],
    };
    state = tickMp(state);
    expect(state.status).toBe('over');
    expect(state.winnerId).toBeNull();
    expect(state.snakes.every((snake) => !snake.alive)).toBe(true);
  });

  it('awards the last living snake', () => {
    let state = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    state = killPlayer(state, 'b');
    expect(state.status).toBe('over');
    expect(state.winnerId).toBe('a');
  });

  it('drops a player from the lobby and ends the match if the host leaves', () => {
    const lobby = createMpLobby(PLAYERS.slice(0, 2), 1);
    expect(killPlayer(lobby, 'b').snakes.map((snake) => snake.id)).toEqual(['a']);
    const left = markHostLeft(startMp(lobby));
    expect(left.status).toBe('over');
    expect(left.hostLeft).toBe(true);
  });

  it('mints room and player ids', () => {
    expect(createRoomId()).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
    expect(createPlayerId()).toMatch(/^[0-9a-f]{12}$/);
  });

  it('normalizes pasted room ids', () => {
    expect(normalizeRoomId('  AB-CD 23 ')).toBe('abcd23');
    expect(isRoomId('abcd')).toBe(true);
    expect(isRoomId('abc')).toBe(false);
  });

  it('starts only when every seated player is ready', () => {
    expect(allReadyToStart(PLAYERS)).toBe(false);
    expect(
      allReadyToStart(PLAYERS.map((player) => ({...player, ready: true}))),
    ).toBe(true);
    expect(allReadyToStart([{...PLAYERS[0], ready: true}])).toBe(false);
  });
});
