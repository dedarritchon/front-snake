import {
  baitCountForScore,
  BASE_TICK_MS,
  createRng,
  type Rng,
  SCORE_PER_FOOD,
} from './engine';
import type {Direction, Point} from './types';
import {DIRECTION_DELTA, OPPOSITE} from './types';

export const MP_MAX_PLAYERS = 4;
export const MP_TICK_MS = BASE_TICK_MS;
export const MP_GRID_WIDTH = 29;
export const MP_GRID_HEIGHT = 25;
export const MP_COLORS = ['#2a3816', '#1e4d6b', '#6b2e1e', '#3d2a58'] as const;

export type MpStatus = 'lobby' | 'playing' | 'over';

export interface MpPlayer {
  id: string;
  name: string;
  color: string;
  host: boolean;
  ready: boolean;
}

export interface MpSnake {
  id: string;
  name: string;
  color: string;
  body: Point[];
  direction: Direction;
  pending: Direction;
  alive: boolean;
  score: number;
}

export interface MpState {
  snakes: MpSnake[];
  foods: Point[];
  status: MpStatus;
  winnerId: string | null;
  seed: number;
  rngState: number;
  tick: number;
  gridWidth: number;
  gridHeight: number;
  hostLeft: boolean;
}

const SPAWNS: {body: Point[]; direction: Direction}[] = [
  {
    direction: 'right',
    body: [
      {x: 2, y: 3},
      {x: 1, y: 3},
      {x: 0, y: 3},
    ],
  },
  {
    direction: 'left',
    body: [
      {x: MP_GRID_WIDTH - 3, y: 3},
      {x: MP_GRID_WIDTH - 2, y: 3},
      {x: MP_GRID_WIDTH - 1, y: 3},
    ],
  },
  {
    direction: 'right',
    body: [
      {x: 2, y: MP_GRID_HEIGHT - 4},
      {x: 1, y: MP_GRID_HEIGHT - 4},
      {x: 0, y: MP_GRID_HEIGHT - 4},
    ],
  },
  {
    direction: 'left',
    body: [
      {x: MP_GRID_WIDTH - 3, y: MP_GRID_HEIGHT - 4},
      {x: MP_GRID_WIDTH - 2, y: MP_GRID_HEIGHT - 4},
      {x: MP_GRID_WIDTH - 1, y: MP_GRID_HEIGHT - 4},
    ],
  },
];

function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function cellKey(point: Point): string {
  return `${point.x},${point.y}`;
}

function allBodies(snakes: MpSnake[]): Point[] {
  return snakes.flatMap((snake) => snake.body);
}

function isOccupied(point: Point, occupied: Point[]): boolean {
  return occupied.some((other) => pointsEqual(other, point));
}

function spawnMpFood(occupied: Point[], rng: Rng): Point | null {
  const free: Point[] = [];
  for (let y = 0; y < MP_GRID_HEIGHT; y += 1) {
    for (let x = 0; x < MP_GRID_WIDTH; x += 1) {
      const point = {x, y};
      if (!isOccupied(point, occupied)) {
        free.push(point);
      }
    }
  }
  if (free.length === 0) {
    return null;
  }
  return free[rng.nextInt(free.length)] ?? null;
}

function spawnMpFoods(
  count: number,
  occupied: Point[],
  existing: Point[],
  rng: Rng,
): Point[] {
  const foods = [...existing];
  while (foods.length < count) {
    const next = spawnMpFood([...occupied, ...foods], rng);
    if (!next) {
      break;
    }
    foods.push(next);
  }
  return foods;
}

function refillFoods(
  bodies: Point[],
  foods: Point[],
  score: number,
  rng: Rng,
): Point[] {
  const target = baitCountForScore(score);
  if (foods.length >= target) {
    return foods;
  }
  return spawnMpFoods(target, bodies, foods, rng);
}

export function createRoomId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join('');
}

const ROOM_ID_CHARS = /^[abcdefghjkmnpqrstuvwxyz23456789]+$/;

export function normalizeRoomId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^abcdefghjkmnpqrstuvwxyz23456789]/g, '')
    .slice(0, 8);
}

export function isRoomId(value: string): boolean {
  return value.length >= 4 && value.length <= 8 && ROOM_ID_CHARS.test(value);
}

export function allReadyToStart(players: MpPlayer[]): boolean {
  return players.length >= 2 && players.every((player) => player.ready);
}

export function createPlayerId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

export function createMpLobby(players: MpPlayer[], seed: number): MpState {
  const seated = players.slice(0, MP_MAX_PLAYERS);
  const rng = createRng(seed);
  const snakes = seated.map((player, index) => {
    const spawn = SPAWNS[index] ?? SPAWNS[0];
    return {
      id: player.id,
      name: player.name,
      color: player.color || MP_COLORS[index] || MP_COLORS[0],
      body: spawn.body.map((point) => ({...point})),
      direction: spawn.direction,
      pending: spawn.direction,
      alive: true,
      score: 0,
    };
  });

  return {
    snakes,
    foods: [],
    status: 'lobby',
    winnerId: null,
    seed,
    rngState: rng.state(),
    tick: 0,
    gridWidth: MP_GRID_WIDTH,
    gridHeight: MP_GRID_HEIGHT,
    hostLeft: false,
  };
}

export function startMp(state: MpState, seed = state.seed): MpState {
  if (state.snakes.length < 2) {
    return state;
  }
  const rng = createRng(seed);
  const snakes = state.snakes.map((snake, index) => {
    const spawn = SPAWNS[index] ?? SPAWNS[0];
    return {
      ...snake,
      body: spawn.body.map((point) => ({...point})),
      direction: spawn.direction,
      pending: spawn.direction,
      alive: true,
      score: 0,
    };
  });
  const foods = refillFoods(allBodies(snakes), [], 0, rng);
  return {
    ...state,
    snakes,
    foods,
    status: 'playing',
    winnerId: null,
    seed,
    rngState: rng.state(),
    tick: 0,
    hostLeft: false,
  };
}

export function queueMpInput(
  state: MpState,
  playerId: string,
  next: Direction,
): MpState {
  if (state.status !== 'playing') {
    return state;
  }
  return {
    ...state,
    snakes: state.snakes.map((snake) => {
      if (snake.id !== playerId || !snake.alive) {
        return snake;
      }
      if (OPPOSITE[snake.direction] === next) {
        return snake;
      }
      return {...snake, pending: next};
    }),
  };
}

export function killPlayer(state: MpState, playerId: string): MpState {
  if (state.status !== 'playing') {
    return {
      ...state,
      snakes: state.snakes.filter((snake) => snake.id !== playerId),
    };
  }
  const snakes = state.snakes.map((snake) =>
    snake.id === playerId ? {...snake, alive: false} : snake,
  );
  return resolveWinner({...state, snakes});
}

export function markHostLeft(state: MpState): MpState {
  if (state.status === 'lobby') {
    return {...state, hostLeft: true, status: 'over'};
  }
  if (state.status !== 'playing') {
    return {...state, hostLeft: true};
  }
  return resolveWinner({...state, hostLeft: true, status: 'over'});
}

function resolveWinner(state: MpState): MpState {
  const alive = state.snakes.filter((snake) => snake.alive);
  if (alive.length > 1 && !state.hostLeft) {
    return state;
  }
  if (alive.length === 1 && state.snakes.length > 1) {
    return {
      ...state,
      status: 'over',
      winnerId: alive[0].id,
    };
  }
  return {
    ...state,
    status: 'over',
    winnerId: null,
  };
}

export function tickMp(state: MpState): MpState {
  if (state.status !== 'playing') {
    return state;
  }

  const rng = createRng(state.rngState);
  const alive = state.snakes.filter((snake) => snake.alive);
  const nextHead = new Map<string, Point>();
  const nextDir = new Map<string, Direction>();

  for (const snake of alive) {
    const dir =
      OPPOSITE[snake.direction] === snake.pending
        ? snake.direction
        : snake.pending;
    nextDir.set(snake.id, dir);
    const head = snake.body[0];
    const delta = DIRECTION_DELTA[dir];
    nextHead.set(snake.id, {x: head.x + delta.x, y: head.y + delta.y});
  }

  const dying = new Set<string>();
  const byCell = new Map<string, string[]>();
  for (const [id, head] of nextHead) {
    const key = cellKey(head);
    const list = byCell.get(key) ?? [];
    list.push(id);
    byCell.set(key, list);
  }
  for (const ids of byCell.values()) {
    if (ids.length > 1) {
      for (const id of ids) {
        dying.add(id);
      }
    }
  }

  for (let i = 0; i < alive.length; i += 1) {
    for (let j = i + 1; j < alive.length; j += 1) {
      const a = alive[i];
      const b = alive[j];
      const headA = nextHead.get(a.id);
      const headB = nextHead.get(b.id);
      if (!headA || !headB) {
        continue;
      }
      if (pointsEqual(headA, b.body[0]) && pointsEqual(headB, a.body[0])) {
        dying.add(a.id);
        dying.add(b.id);
      }
    }
  }

  const eating = new Set<string>();
  for (const snake of alive) {
    if (dying.has(snake.id)) {
      continue;
    }
    const head = nextHead.get(snake.id);
    if (head && state.foods.some((food) => pointsEqual(food, head))) {
      eating.add(snake.id);
    }
  }

  const occupied: Point[] = [];
  for (const snake of state.snakes) {
    const skipTail =
      snake.alive &&
      !dying.has(snake.id) &&
      !eating.has(snake.id) &&
      snake.body.length > 0;
    occupied.push(...(skipTail ? snake.body.slice(0, -1) : snake.body));
  }

  for (const snake of alive) {
    if (dying.has(snake.id)) {
      continue;
    }
    const head = nextHead.get(snake.id);
    if (!head) {
      dying.add(snake.id);
      continue;
    }
    if (
      head.x < 0 ||
      head.x >= MP_GRID_WIDTH ||
      head.y < 0 ||
      head.y >= MP_GRID_HEIGHT
    ) {
      dying.add(snake.id);
      continue;
    }
    if (occupied.some((point) => pointsEqual(point, head))) {
      dying.add(snake.id);
    }
  }

  for (const id of dying) {
    eating.delete(id);
  }

  const snakes = state.snakes.map((snake) => {
    if (!snake.alive) {
      return snake;
    }
    if (dying.has(snake.id)) {
      return {...snake, alive: false};
    }
    const dir = nextDir.get(snake.id) ?? snake.direction;
    const head = nextHead.get(snake.id);
    if (!head) {
      return {...snake, alive: false};
    }
    const ate = eating.has(snake.id);
    const body = ate
      ? [head, ...snake.body]
      : [head, ...snake.body.slice(0, -1)];
    return {
      ...snake,
      body,
      direction: dir,
      pending: dir,
      score: ate ? snake.score + SCORE_PER_FOOD : snake.score,
    };
  });

  const remainingFoods = state.foods.filter(
    (food) =>
      ![...eating].some((id) => {
        const head = nextHead.get(id);
        return head ? pointsEqual(head, food) : false;
      }),
  );
  const maxScore = Math.max(0, ...snakes.map((snake) => snake.score));
  const foods = refillFoods(allBodies(snakes), remainingFoods, maxScore, rng);

  return resolveWinner({
    ...state,
    snakes,
    foods,
    rngState: rng.state(),
    tick: state.tick + 1,
  });
}
