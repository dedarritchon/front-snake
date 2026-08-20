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
export const MP_REPLAY_TICK_MS = 420;
export const MP_REPLAY_FRAMES = 10;
export const MP_GRID_WIDTH = 29;
export const MP_GRID_HEIGHT = 25;
export const MP_COLORS = ['#2b6cb0', '#d4531e', '#8b3aaf', '#0f8a7a'] as const;

export type MpStatus = 'lobby' | 'playing' | 'replay' | 'over';
export type MpDeathCause = 'wall' | 'self' | 'body' | 'head' | 'left';

export interface MpDeath {
  playerId: string;
  cause: MpDeathCause;
  otherId: string | null;
}

export interface MpSnapshot {
  snakes: MpSnake[];
  foods: Point[];
}

export interface MpPlayer {
  id: string;
  name: string;
  color: string;
  host: boolean;
  ready: boolean;
  joinedAt: number;
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
  lastDeaths: MpDeath[];
  replay: MpSnapshot[];
  replayIndex: number;
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

function occupancySet(points: Point[]): Set<string> {
  const occupied = new Set<string>();
  for (const point of points) {
    occupied.add(cellKey(point));
  }
  return occupied;
}

function spawnMpFood(occupied: Set<string>, rng: Rng): Point | null {
  const free: Point[] = [];
  for (let y = 0; y < MP_GRID_HEIGHT; y += 1) {
    for (let x = 0; x < MP_GRID_WIDTH; x += 1) {
      if (!occupied.has(`${x},${y}`)) {
        free.push({x, y});
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
  const blocked = occupancySet(occupied);
  for (const food of foods) {
    blocked.add(cellKey(food));
  }
  while (foods.length < count) {
    const next = spawnMpFood(blocked, rng);
    if (!next) {
      break;
    }
    foods.push(next);
    blocked.add(cellKey(next));
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

export function snapshotMp(state: MpState): MpSnapshot {
  return {
    snakes: state.snakes.map((snake) => ({
      ...snake,
      body: snake.body.map((point) => ({...point})),
    })),
    foods: state.foods.map((point) => ({...point})),
  };
}

export function toWireState(state: MpState): MpState {
  if (state.replay.length === 0) {
    return state;
  }
  return {...state, replay: []};
}

export function shouldSlowMo(_previous: MpState, next: MpState): boolean {
  if (next.status !== 'over') {
    return false;
  }
  if (next.lastDeaths.length === 0) {
    return false;
  }
  return !next.lastDeaths.every((death) => death.cause === 'left');
}

export function shouldPersonalSlowMo(
  previous: MpState,
  next: MpState,
  playerId: string,
): boolean {
  if (next.status !== 'playing') {
    return false;
  }
  const was = previous.snakes.find((snake) => snake.id === playerId);
  const now = next.snakes.find((snake) => snake.id === playerId);
  if (!was?.alive || now?.alive !== false) {
    return false;
  }
  return next.lastDeaths.some(
    (death) => death.playerId === playerId && death.cause !== 'left',
  );
}

export function beginReplay(state: MpState, frames: MpSnapshot[]): MpState {
  if (frames.length === 0) {
    return state;
  }
  const first = frames[0];
  return {
    ...state,
    status: 'replay',
    snakes: first.snakes,
    foods: first.foods,
    replay: frames,
    replayIndex: 0,
  };
}

export function advanceReplay(state: MpState): MpState {
  if (state.status !== 'replay') {
    return state;
  }
  const nextIndex = state.replayIndex + 1;
  if (nextIndex >= state.replay.length) {
    return {
      ...state,
      status: 'over',
      replay: [],
      replayIndex: 0,
    };
  }
  const frame = state.replay[nextIndex];
  return {
    ...state,
    replayIndex: nextIndex,
    snakes: frame.snakes,
    foods: frame.foods,
  };
}

export function describeDeaths(deaths: MpDeath[], snakes: MpSnake[]): string {
  const nameOf = (id: string): string =>
    snakes.find((snake) => snake.id === id)?.name ?? 'Player';
  const lines: string[] = [];
  const seenHead = new Set<string>();
  for (const death of deaths) {
    if (death.cause === 'head' && death.otherId) {
      const key = [death.playerId, death.otherId].sort().join(':');
      if (seenHead.has(key)) {
        continue;
      }
      seenHead.add(key);
      lines.push(`${nameOf(death.playerId)} and ${nameOf(death.otherId)} crashed`);
      continue;
    }
    if (death.cause === 'wall') {
      lines.push(`${nameOf(death.playerId)} hit the wall`);
      continue;
    }
    if (death.cause === 'self') {
      lines.push(`${nameOf(death.playerId)} bit themself`);
      continue;
    }
    if (death.cause === 'body') {
      lines.push(
        death.otherId
          ? `${nameOf(death.playerId)} ran into ${nameOf(death.otherId)}`
          : `${nameOf(death.playerId)} hit a snake`,
      );
      continue;
    }
    lines.push(`${nameOf(death.playerId)} left`);
  }
  return lines.join(' · ');
}

function rememberDeath(
  deaths: Map<string, MpDeath>,
  playerId: string,
  cause: MpDeathCause,
  otherId: string | null = null,
): void {
  if (!deaths.has(playerId)) {
    deaths.set(playerId, {playerId, cause, otherId});
  }
}

function bodyOwner(snakes: MpSnake[], point: Point): MpSnake | undefined {
  return snakes.find((snake) =>
    snake.body.some((segment) => pointsEqual(segment, point)),
  );
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
    lastDeaths: [],
    replay: [],
    replayIndex: 0,
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
    lastDeaths: [],
    replay: [],
    replayIndex: 0,
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
  return resolveWinner({
    ...state,
    snakes,
    lastDeaths: [{playerId, cause: 'left', otherId: null}],
  });
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
  const deaths = new Map<string, MpDeath>();

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
        rememberDeath(
          deaths,
          id,
          'head',
          ids.find((other) => other !== id) ?? null,
        );
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
        rememberDeath(deaths, a.id, 'head', b.id);
        rememberDeath(deaths, b.id, 'head', a.id);
      }
    }
  }

  const eating = new Set<string>();
  const foodCells = occupancySet(state.foods);
  for (const snake of alive) {
    if (dying.has(snake.id)) {
      continue;
    }
    const head = nextHead.get(snake.id);
    if (head && foodCells.has(cellKey(head))) {
      eating.add(snake.id);
    }
  }

  const occupied = new Set<string>();
  for (const snake of state.snakes) {
    const skipTail =
      snake.alive &&
      !dying.has(snake.id) &&
      !eating.has(snake.id) &&
      snake.body.length > 0;
    const body = skipTail ? snake.body.slice(0, -1) : snake.body;
    for (const point of body) {
      occupied.add(cellKey(point));
    }
  }

  for (const snake of alive) {
    if (dying.has(snake.id)) {
      continue;
    }
    const head = nextHead.get(snake.id);
    if (!head) {
      dying.add(snake.id);
      rememberDeath(deaths, snake.id, 'wall');
      continue;
    }
    if (
      head.x < 0 ||
      head.x >= MP_GRID_WIDTH ||
      head.y < 0 ||
      head.y >= MP_GRID_HEIGHT
    ) {
      dying.add(snake.id);
      rememberDeath(deaths, snake.id, 'wall');
      continue;
    }
    if (occupied.has(cellKey(head))) {
      dying.add(snake.id);
      const owner = bodyOwner(state.snakes, head);
      if (!owner || owner.id === snake.id) {
        rememberDeath(deaths, snake.id, 'self');
      } else {
        rememberDeath(deaths, snake.id, 'body', owner.id);
      }
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

  const eatenHeads = new Set<string>();
  for (const id of eating) {
    const head = nextHead.get(id);
    if (head) {
      eatenHeads.add(cellKey(head));
    }
  }
  const remainingFoods = state.foods.filter(
    (food) => !eatenHeads.has(cellKey(food)),
  );
  const maxScore = Math.max(0, ...snakes.map((snake) => snake.score));
  const foods = refillFoods(allBodies(snakes), remainingFoods, maxScore, rng);

  return resolveWinner({
    ...state,
    snakes,
    foods,
    rngState: rng.state(),
    tick: state.tick + 1,
    lastDeaths: deaths.size > 0 ? [...deaths.values()] : state.lastDeaths,
  });
}
