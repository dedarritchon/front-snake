import {describe, expect, it} from 'vitest';

import {
  baitCountForScore,
  BASE_TICK_MS,
  createRng,
  createSimState,
  gameLevel,
  GRID_HEIGHT,
  GRID_WIDTH,
  isDirection,
  MAX_REPLAY_TICKS,
  MIN_TICK_MS,
  queueDirection,
  replayGame,
  SCORE_PER_FOOD,
  spawnFood,
  spawnFoods,
  tick,
  tickMsForScore,
  togglePause,
} from './engine';
import type {Direction, GameState, Point} from './types';

function play(seed: number, inputs: Direction[]) {
  let state = createSimState('test', seed);
  const recorded: Direction[] = [];
  for (const input of inputs) {
    state = queueDirection(state, input);
    if (state.status !== 'playing' && state.status !== 'gameover') {
      break;
    }
    recorded.push(state.pendingDirection);
    state = tick(state);
    if (state.status === 'gameover') {
      break;
    }
  }
  return {state, recorded};
}

function withSnake(
  state: GameState,
  snake: Point[],
  extras: Partial<GameState> = {},
): GameState {
  return {
    ...state,
    snake,
    status: 'playing',
    ...extras,
  };
}

describe('createSimState', () => {
  it('starts ready, length 3, facing right at grid center', () => {
    const state = createSimState('lobby', 1);
    expect(state.status).toBe('ready');
    expect(state.direction).toBe('right');
    expect(state.snake).toHaveLength(3);
    expect(state.snake[0]).toEqual({
      x: Math.floor(GRID_WIDTH / 2),
      y: Math.floor(GRID_HEIGHT / 2),
    });
    expect(state.gridWidth).toBe(GRID_WIDTH);
    expect(state.gridHeight).toBe(GRID_HEIGHT);
    expect(state.score).toBe(0);
  });

  it('same seed produces the same first food', () => {
    const a = createSimState('a', 99);
    const b = createSimState('b', 99);
    expect(a.foods).toEqual(b.foods);
  });

  it('starts with food that is not on the snake', () => {
    const state = createSimState('test', 99);
    expect(state.foods.length).toBeGreaterThan(0);
    for (const food of state.foods) {
      expect(
        state.snake.some((segment) => segment.x === food.x && segment.y === food.y),
      ).toBe(false);
    }
  });
});

describe('queueDirection and pause', () => {
  it('starts the run from ready', () => {
    const state = queueDirection(createSimState('test', 1), 'up');
    expect(state.status).toBe('playing');
    expect(state.pendingDirection).toBe('up');
  });

  it('records applied direction, not a reversed input', () => {
    const {state, recorded} = play(7, ['right', 'left', 'right']);
    expect(recorded.every((direction) => direction === 'right')).toBe(true);
    expect(state.direction).toBe('right');
  });

  it('ignores input while paused or over', () => {
    const playing = queueDirection(createSimState('test', 1), 'right');
    const paused = togglePause(playing);
    expect(paused.status).toBe('paused');
    expect(queueDirection(paused, 'up')).toBe(paused);
    const over = {...playing, status: 'gameover' as const};
    expect(queueDirection(over, 'up')).toBe(over);
  });

  it('toggles pause only from playing', () => {
    const ready = createSimState('test', 1);
    expect(togglePause(ready).status).toBe('ready');
    const playing = queueDirection(ready, 'right');
    const paused = togglePause(playing);
    expect(paused.status).toBe('paused');
    expect(togglePause(paused).status).toBe('playing');
  });
});

describe('tick', () => {
  it('does not move unless playing', () => {
    const ready = createSimState('test', 1);
    expect(tick(ready)).toBe(ready);
    const paused = togglePause(queueDirection(ready, 'right'));
    expect(tick(paused)).toEqual(paused);
  });

  it('steps the head forward and drops the tail', () => {
    const start = queueDirection(createSimState('test', 1), 'right');
    const next = tick({
      ...start,
      foods: [{x: 0, y: 0}],
    });
    expect(next.snake[0]).toEqual({
      x: start.snake[0].x + 1,
      y: start.snake[0].y,
    });
    expect(next.snake).toHaveLength(3);
    expect(next.score).toBe(0);
  });

  it('grows and scores when the head hits food', () => {
    const start = queueDirection(createSimState('test', 1), 'right');
    const bait = {x: start.snake[0].x + 1, y: start.snake[0].y};
    const next = tick({...start, foods: [bait]});
    expect(next.score).toBe(SCORE_PER_FOOD);
    expect(next.snake).toHaveLength(4);
    expect(next.snake[0]).toEqual(bait);
    expect(next.foods.some((food) => food.x === bait.x && food.y === bait.y)).toBe(
      false,
    );
    expect(next.foods.length).toBeGreaterThan(0);
  });

  it('ends the run on a wall', () => {
    const start = queueDirection(createSimState('test', 1), 'right');
    const next = tick(
      withSnake(start, [{x: GRID_WIDTH - 1, y: 10}, {x: GRID_WIDTH - 2, y: 10}]),
    );
    expect(next.status).toBe('gameover');
  });

  it('ends the run on its own body', () => {
    const start = queueDirection(createSimState('test', 1), 'down');
    const next = tick(
      withSnake(start, [
        {x: 5, y: 5},
        {x: 5, y: 6},
        {x: 5, y: 7},
      ]),
    );
    expect(next.status).toBe('gameover');
  });

  it('keeps the best score from a run', () => {
    const start = queueDirection(createSimState('test', 1, 20), 'right');
    const dead = tick(
      withSnake(start, [{x: GRID_WIDTH - 1, y: 10}, {x: GRID_WIDTH - 2, y: 10}], {
        score: 10,
      }),
    );
    expect(dead.highScore).toBe(20);
  });
});

describe('difficulty', () => {
  it('adds a second apple from level 11', () => {
    expect(gameLevel(0)).toBe(1);
    expect(gameLevel(45)).toBe(10);
    expect(gameLevel(50)).toBe(11);
    expect(baitCountForScore(0)).toBe(1);
    expect(baitCountForScore(45)).toBe(1);
    expect(baitCountForScore(50)).toBe(2);
    expect(baitCountForScore(100)).toBe(3);
  });

  it('caps bait count and tick speed', () => {
    expect(baitCountForScore(10_000)).toBe(5);
    expect(tickMsForScore(0, 3)).toBe(BASE_TICK_MS);
    expect(tickMsForScore(10_000, 80)).toBe(MIN_TICK_MS);
  });
});

describe('food spawn', () => {
  it('never lands on the snake or existing bait', () => {
    const rng = createRng(42);
    const snake = [
      {x: 0, y: 0},
      {x: 1, y: 0},
    ];
    const existing = [{x: 2, y: 0}];
    const food = spawnFood(snake, existing, rng);
    expect(food).not.toBeNull();
    expect(food).not.toEqual({x: 0, y: 0});
    expect(food).not.toEqual({x: 1, y: 0});
    expect(food).not.toEqual({x: 2, y: 0});
  });

  it('returns null when the board is full', () => {
    const rng = createRng(1);
    const snake: Point[] = [];
    for (let y = 0; y < GRID_HEIGHT; y += 1) {
      for (let x = 0; x < GRID_WIDTH; x += 1) {
        snake.push({x, y});
      }
    }
    expect(spawnFood(snake, [], rng)).toBeNull();
    expect(spawnFoods(3, snake, [], rng)).toEqual([]);
  });
});

describe('rng and helpers', () => {
  it('replays the same number stream for a seed', () => {
    const a = createRng(7);
    const b = createRng(7);
    expect([a.next(), a.nextInt(10)]).toEqual([b.next(), b.nextInt(10)]);
  });

  it('accepts only the four directions', () => {
    expect(isDirection('up')).toBe(true);
    expect(isDirection('down')).toBe(true);
    expect(isDirection('left')).toBe(true);
    expect(isDirection('right')).toBe(true);
    expect(isDirection('forward')).toBe(false);
    expect(isDirection(1)).toBe(false);
  });
});

describe('engine replay', () => {
  it('matches live ticks for the same seed', () => {
    const seed = 12345;
    let state = createSimState('test', seed);
    const directions: Direction[] = [];
    const plan: Direction[] = [
      'right',
      'right',
      'up',
      'up',
      'left',
      'left',
      'down',
      'down',
      'right',
    ];

    for (const input of plan) {
      state = queueDirection(state, input);
      directions.push(state.pendingDirection);
      state = tick(state);
      if (state.status === 'gameover') {
        break;
      }
    }

    while (state.status !== 'gameover' && directions.length < 400) {
      directions.push(state.pendingDirection);
      state = tick(state);
    }

    expect(state.status).toBe('gameover');
    const replay = replayGame(seed, directions);
    expect(replay.ended).toBe('gameover');
    expect(replay.score).toBe(state.score);
    expect(replay.ticks).toBe(directions.length);
    expect(replay.minDurationMs).toBeGreaterThan(0);
  });

  it('rejects an empty replay', () => {
    expect(replayGame(1, []).ended).toBe('ready');
  });

  it('rejects a replay longer than the tick cap', () => {
    const directions = Array.from(
      {length: MAX_REPLAY_TICKS + 1},
      (): Direction => 'right',
    );
    expect(replayGame(1, directions).ended).toBe('ready');
  });

  it('stops counting once the replay dies mid-list', () => {
    const {state, recorded} = play(7, Array.from({length: 80}, () => 'right'));
    expect(state.status).toBe('gameover');
    const replay = replayGame(7, [...recorded, 'up', 'left', 'down']);
    expect(replay.ended).toBe('gameover');
    expect(replay.ticks).toBe(recorded.length);
    expect(replay.score).toBe(state.score);
  });
});

describe('walls and spawn bounds', () => {
  it('dies on the top and bottom edges', () => {
    const start = queueDirection(createSimState('test', 1), 'up');
    expect(
      tick(withSnake(start, [{x: 5, y: 0}, {x: 5, y: 1}])).status,
    ).toBe('gameover');
    const down = queueDirection(createSimState('test', 1), 'down');
    expect(
      tick(
        withSnake(down, [
          {x: 5, y: GRID_HEIGHT - 1},
          {x: 5, y: GRID_HEIGHT - 2},
        ]),
      ).status,
    ).toBe('gameover');
  });

  it('keeps every apple on the 22x40 board', () => {
    const state = createSimState('test', 2026);
    for (const food of state.foods) {
      expect(food.x).toBeGreaterThanOrEqual(0);
      expect(food.x).toBeLessThan(GRID_WIDTH);
      expect(food.y).toBeGreaterThanOrEqual(0);
      expect(food.y).toBeLessThan(GRID_HEIGHT);
    }
  });

  it('does not start a run with a reverse from ready', () => {
    const ready = createSimState('test', 1);
    expect(queueDirection(ready, 'left')).toBe(ready);
    expect(ready.status).toBe('ready');
  });

  it('leaves a finished run untouched', () => {
    const over = {
      ...createSimState('test', 1),
      status: 'gameover' as const,
    };
    expect(tick(over)).toBe(over);
    expect(togglePause(over)).toBe(over);
  });

  it('returns 0 from nextInt when max is not positive', () => {
    expect(createRng(1).nextInt(0)).toBe(0);
    expect(createRng(1).nextInt(-3)).toBe(0);
  });
});
