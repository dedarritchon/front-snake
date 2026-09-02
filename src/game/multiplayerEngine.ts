import {
  baitCountForScore,
  BASE_TICK_MS,
  createRng,
  isDirection,
  type Rng,
  SCORE_PER_FOOD,
} from "./engine";
import { DEFAULT_SNAKE_COLOR, SNAKE_COLORS } from "./snakeColors";
import type { Direction, Point } from "./types";
import { DIRECTION_DELTA, OPPOSITE } from "./types";

export const MP_MAX_PLAYERS = 4;
export const MP_TICK_MS = BASE_TICK_MS;
export const MP_REPLAY_TICK_MS = 420;
export const MP_REPLAY_FRAMES = 10;
export const MP_GRID_WIDTH = 29;
export const MP_GRID_HEIGHT = 25;
export const MP_COLORS = SNAKE_COLORS;
export const MP_POWER_COST = 3;
export const MP_FIRE_COOLDOWN = 2;
export const MP_ROUNDS = 10;
export const MP_WIN_LENGTH = 20;
export const MP_COUNTDOWN_MS = 1000;
export const MP_COUNTDOWN_START = 3;

export type MpStatus = "lobby" | "countdown" | "playing" | "replay" | "over";
export type MpDeathCause = "wall" | "self" | "body" | "head" | "left" | "shot";

export interface MpDeath {
  playerId: string;
  cause: MpDeathCause;
  otherId: string | null;
}

export interface MpShot {
  ownerId: string;
  x: number;
  y: number;
  direction: Direction;
}

export interface MpSnapshot {
  snakes: MpSnake[];
  foods: Point[];
  shots: MpShot[];
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
  power: number;
  queuedFires: number;
  fireCooldown: number;
  roundWins: number;
}

export interface MpState {
  snakes: MpSnake[];
  foods: Point[];
  shots: MpShot[];
  status: MpStatus;
  winnerId: string | null;
  matchRound: number;
  countdown: number;
  roundWinnerId: string | null;
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

const SPAWNS: { body: Point[]; direction: Direction }[] = [
  {
    direction: "right",
    body: [
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 0, y: 3 },
    ],
  },
  {
    direction: "left",
    body: [
      { x: MP_GRID_WIDTH - 3, y: 3 },
      { x: MP_GRID_WIDTH - 2, y: 3 },
      { x: MP_GRID_WIDTH - 1, y: 3 },
    ],
  },
  {
    direction: "right",
    body: [
      { x: 2, y: MP_GRID_HEIGHT - 4 },
      { x: 1, y: MP_GRID_HEIGHT - 4 },
      { x: 0, y: MP_GRID_HEIGHT - 4 },
    ],
  },
  {
    direction: "left",
    body: [
      { x: MP_GRID_WIDTH - 3, y: MP_GRID_HEIGHT - 4 },
      { x: MP_GRID_WIDTH - 2, y: MP_GRID_HEIGHT - 4 },
      { x: MP_GRID_WIDTH - 1, y: MP_GRID_HEIGHT - 4 },
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
        free.push({ x, y });
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
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}

const ROOM_ID_CHARS = /^[abcdefghjkmnpqrstuvwxyz23456789]+$/;

export function normalizeRoomId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^abcdefghjkmnpqrstuvwxyz23456789]/g, "")
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
      body: snake.body.map((point) => ({ ...point })),
    })),
    foods: state.foods.map((point) => ({ ...point })),
    shots: state.shots.map((shot) => ({ ...shot })),
  };
}

export function mpRound(snakes: MpSnake[]): number {
  const apples =
    snakes.reduce((sum, snake) => sum + snake.score, 0) / SCORE_PER_FOOD;
  return 1 + Math.floor(Math.max(0, apples));
}

export function mpTickMs(state: MpState): number {
  return state.status === "replay" ? MP_REPLAY_TICK_MS : MP_TICK_MS;
}

export function keepLocalIntent(
  host: MpState,
  local: MpState | null,
  playerId: string,
): MpState {
  if (
    host.status !== local?.status ||
    (host.status !== "playing" && host.status !== "countdown")
  ) {
    return host;
  }
  const mine = local.snakes.find((snake) => snake.id === playerId);
  if (!mine?.alive) {
    return host;
  }
  let next = queueMpInput(host, playerId, mine.pending);
  if (host.tick === local.tick && mine.queuedFires > 0) {
    next = {
      ...next,
      snakes: next.snakes.map((snake) =>
        snake.id === playerId
          ? {
              ...snake,
              queuedFires: Math.max(snake.queuedFires, mine.queuedFires),
            }
          : snake,
      ),
    };
  }
  return next;
}

interface MpWireSnake {
  id: string;
  name: string;
  color: string;
  body: number[];
  direction: Direction;
  pending: Direction;
  alive: boolean;
  score: number;
  power: number;
  queuedFires?: number;
  fireCooldown?: number;
  pendingFire?: boolean;
  roundWins?: number;
}

interface MpWireSnapshot {
  snakes: MpWireSnake[];
  foods: number[];
  shots: MpShot[];
}

export interface MpWireState {
  tick: number;
  status: MpStatus;
  seed: number;
  rngState: number;
  winnerId?: string | null;
  matchRound?: number;
  countdown?: number;
  roundWinnerId?: string | null;
  hostLeft?: boolean;
  replayIndex?: number;
  snakes: MpWireSnake[];
  foods: number[];
  shots?: MpShot[];
  lastDeaths?: MpDeath[];
  replay?: MpWireSnapshot[];
}

function packPoints(points: Point[]): number[] {
  const packed = new Array<number>(points.length * 2);
  for (let index = 0; index < points.length; index += 1) {
    packed[index * 2] = points[index].x;
    packed[index * 2 + 1] = points[index].y;
  }
  return packed;
}

function unpackPoints(value: unknown): Point[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value as unknown[];
  if (items.length === 0) {
    return [];
  }
  if (typeof items[0] === "object" && items[0] !== null) {
    const points: Point[] = [];
    for (const item of items) {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const row = item as { x?: unknown; y?: unknown };
      if (typeof row.x !== "number" || typeof row.y !== "number") {
        return null;
      }
      points.push({ x: row.x, y: row.y });
    }
    return points;
  }
  if (items.length % 2 !== 0) {
    return null;
  }
  const points: Point[] = [];
  for (let index = 0; index < items.length; index += 2) {
    const x = items[index];
    const y = items[index + 1];
    if (typeof x !== "number" || typeof y !== "number") {
      return null;
    }
    points.push({ x, y });
  }
  return points;
}

function packSnake(snake: MpSnake): MpWireSnake {
  const packed: MpWireSnake = {
    id: snake.id,
    name: snake.name,
    color: snake.color,
    body: packPoints(snake.body),
    direction: snake.direction,
    pending: snake.pending,
    alive: snake.alive,
    score: snake.score,
    power: snake.power,
  };
  if (snake.queuedFires > 0) {
    packed.queuedFires = snake.queuedFires;
  }
  if (snake.fireCooldown > 0) {
    packed.fireCooldown = snake.fireCooldown;
  }
  if (snake.roundWins > 0) {
    packed.roundWins = snake.roundWins;
  }
  return packed;
}

function unpackSnake(value: unknown): MpSnake | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const body = unpackPoints(row.body);
  if (
    typeof row.id !== "string" ||
    typeof row.name !== "string" ||
    typeof row.color !== "string" ||
    !body ||
    !isDirection(row.direction) ||
    !isDirection(row.pending) ||
    typeof row.alive !== "boolean" ||
    typeof row.score !== "number" ||
    typeof row.power !== "number"
  ) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    body,
    direction: row.direction,
    pending: row.pending,
    alive: row.alive,
    score: row.score,
    power: row.power,
    queuedFires:
      typeof row.queuedFires === "number"
        ? Math.max(0, Math.floor(row.queuedFires))
        : row.pendingFire === true
          ? 1
          : 0,
    fireCooldown:
      typeof row.fireCooldown === "number"
        ? Math.max(0, Math.floor(row.fireCooldown))
        : 0,
    roundWins:
      typeof row.roundWins === "number"
        ? Math.max(0, Math.floor(row.roundWins))
        : 0,
  };
}

function packSnapshot(snapshot: MpSnapshot): MpWireSnapshot {
  return {
    snakes: snapshot.snakes.map(packSnake),
    foods: packPoints(snapshot.foods),
    shots: snapshot.shots,
  };
}

function unpackSnapshot(value: unknown): MpSnapshot | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const foods = unpackPoints(row.foods);
  if (!Array.isArray(row.snakes) || !foods || !Array.isArray(row.shots)) {
    return null;
  }
  const snakes: MpSnake[] = [];
  for (const item of row.snakes) {
    const snake = unpackSnake(item);
    if (!snake) {
      return null;
    }
    snakes.push(snake);
  }
  return { snakes, foods, shots: row.shots as MpShot[] };
}

function isMpStatus(value: unknown): value is MpStatus {
  return (
    value === "lobby" ||
    value === "countdown" ||
    value === "playing" ||
    value === "replay" ||
    value === "over"
  );
}

export function toWireState(state: MpState): MpWireState {
  const wire: MpWireState = {
    tick: state.tick,
    status: state.status,
    seed: state.seed,
    rngState: state.rngState,
    snakes: state.snakes.map(packSnake),
    foods: packPoints(state.foods),
  };
  if (state.winnerId) {
    wire.winnerId = state.winnerId;
  }
  wire.matchRound = state.matchRound;
  if (state.countdown > 0) {
    wire.countdown = state.countdown;
  }
  if (state.roundWinnerId) {
    wire.roundWinnerId = state.roundWinnerId;
  }
  if (state.hostLeft) {
    wire.hostLeft = true;
  }
  if (state.replayIndex > 0) {
    wire.replayIndex = state.replayIndex;
  }
  if (state.shots.length > 0) {
    wire.shots = state.shots;
  }
  if (state.lastDeaths.length > 0) {
    wire.lastDeaths = state.lastDeaths;
  }
  if (state.status === "over" && state.replay.length > 0) {
    wire.replay = state.replay.map(packSnapshot);
  }
  return wire;
}

export function fromWireState(payload: unknown): MpState | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const row = payload as Record<string, unknown>;
  const foods = unpackPoints(row.foods);
  if (
    typeof row.tick !== "number" ||
    !isMpStatus(row.status) ||
    typeof row.seed !== "number" ||
    typeof row.rngState !== "number" ||
    !Array.isArray(row.snakes) ||
    !foods
  ) {
    return null;
  }
  const snakes: MpSnake[] = [];
  for (const item of row.snakes) {
    const snake = unpackSnake(item);
    if (!snake) {
      return null;
    }
    snakes.push(snake);
  }
  const replay: MpSnapshot[] = [];
  if (row.replay !== undefined) {
    if (!Array.isArray(row.replay)) {
      return null;
    }
    for (const item of row.replay) {
      const snapshot = unpackSnapshot(item);
      if (!snapshot) {
        return null;
      }
      replay.push(snapshot);
    }
  }
  const shots = Array.isArray(row.shots) ? (row.shots as MpShot[]) : [];
  const lastDeaths = Array.isArray(row.lastDeaths)
    ? (row.lastDeaths as MpDeath[])
    : [];
  return {
    snakes,
    foods,
    shots,
    status: row.status,
    winnerId: typeof row.winnerId === "string" ? row.winnerId : null,
    seed: row.seed,
    rngState: row.rngState,
    tick: row.tick,
    gridWidth: MP_GRID_WIDTH,
    gridHeight: MP_GRID_HEIGHT,
    hostLeft: row.hostLeft === true,
    lastDeaths,
    replay,
    replayIndex: typeof row.replayIndex === "number" ? row.replayIndex : 0,
    matchRound: typeof row.matchRound === "number" ? row.matchRound : 1,
    countdown: typeof row.countdown === "number" ? row.countdown : 0,
    roundWinnerId:
      typeof row.roundWinnerId === "string" ? row.roundWinnerId : null,
  };
}

export function hasSlowMoClip(state: MpState): boolean {
  return state.replay.length > 0;
}

export function shouldSlowMo(_previous: MpState, next: MpState): boolean {
  if (next.status !== "over") {
    return false;
  }
  if (next.lastDeaths.length === 0) {
    return false;
  }
  return !next.lastDeaths.every((death) => death.cause === "left");
}

export function shouldPersonalSlowMo(
  previous: MpState,
  next: MpState,
  playerId: string,
): boolean {
  if (next.status !== "playing") {
    return false;
  }
  const was = previous.snakes.find((snake) => snake.id === playerId);
  const now = next.snakes.find((snake) => snake.id === playerId);
  if (!was?.alive || now?.alive !== false) {
    return false;
  }
  return next.lastDeaths.some(
    (death) => death.playerId === playerId && death.cause !== "left",
  );
}

export function beginReplay(state: MpState, frames: MpSnapshot[]): MpState {
  if (frames.length === 0) {
    return state;
  }
  const first = frames[0];
  return {
    ...state,
    status: "replay",
    snakes: first.snakes,
    foods: first.foods,
    shots: first.shots,
    replay: frames,
    replayIndex: 0,
  };
}

export function advanceReplay(state: MpState): MpState {
  if (state.status !== "replay") {
    return state;
  }
  const nextIndex = state.replayIndex + 1;
  if (nextIndex >= state.replay.length) {
    return {
      ...state,
      status: "over",
      replayIndex: 0,
    };
  }
  const frame = state.replay[nextIndex];
  return {
    ...state,
    replayIndex: nextIndex,
    snakes: frame.snakes,
    foods: frame.foods,
    shots: frame.shots,
  };
}

export function describeDeaths(deaths: MpDeath[], snakes: MpSnake[]): string {
  const nameOf = (id: string): string =>
    snakes.find((snake) => snake.id === id)?.name ?? "Player";
  const lines: string[] = [];
  const seenHead = new Set<string>();
  for (const death of deaths) {
    if (death.cause === "head" && death.otherId) {
      const key = [death.playerId, death.otherId].sort().join(":");
      if (seenHead.has(key)) {
        continue;
      }
      seenHead.add(key);
      lines.push(
        `${nameOf(death.playerId)} and ${nameOf(death.otherId)} crashed`,
      );
      continue;
    }
    if (death.cause === "wall") {
      lines.push(`${nameOf(death.playerId)} hit the wall`);
      continue;
    }
    if (death.cause === "self") {
      lines.push(`${nameOf(death.playerId)} bit themself`);
      continue;
    }
    if (death.cause === "body") {
      lines.push(
        death.otherId
          ? `${nameOf(death.playerId)} ran into ${nameOf(death.otherId)}`
          : `${nameOf(death.playerId)} hit a snake`,
      );
      continue;
    }
    if (death.cause === "shot") {
      lines.push(
        death.otherId
          ? `${nameOf(death.otherId)} shot ${nameOf(death.playerId)}`
          : `${nameOf(death.playerId)} was shot`,
      );
      continue;
    }
    lines.push(`${nameOf(death.playerId)} left`);
  }
  return lines.join(" · ");
}

function rememberDeath(
  deaths: Map<string, MpDeath>,
  playerId: string,
  cause: MpDeathCause,
  otherId: string | null = null,
): void {
  if (!deaths.has(playerId)) {
    deaths.set(playerId, { playerId, cause, otherId });
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
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
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
      color: player.color || SNAKE_COLORS[index] || DEFAULT_SNAKE_COLOR,
      body: spawn.body.map((point) => ({ ...point })),
      direction: spawn.direction,
      pending: spawn.direction,
      alive: true,
      score: 0,
      power: 0,
      queuedFires: 0,
      fireCooldown: 0,
      roundWins: 0,
    };
  });

  return {
    snakes,
    foods: [],
    shots: [],
    status: "lobby",
    winnerId: null,
    matchRound: 1,
    countdown: 0,
    roundWinnerId: null,
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

function respawnSnakes(from: MpSnake[], resetMatch: boolean): MpSnake[] {
  return from.map((snake, index) => {
    const spawn = SPAWNS[index] ?? SPAWNS[0];
    return {
      ...snake,
      body: spawn.body.map((point) => ({ ...point })),
      direction: spawn.direction,
      pending: spawn.direction,
      alive: true,
      score: 0,
      power: 0,
      queuedFires: 0,
      fireCooldown: 0,
      roundWins: resetMatch ? 0 : snake.roundWins,
    };
  });
}

export function beginRound(
  state: MpState,
  seed: number,
  options: { resetMatch: boolean },
): MpState {
  if (state.snakes.length < 2) {
    return state;
  }
  const rng = createRng(seed);
  const snakes = respawnSnakes(state.snakes, options.resetMatch);
  const foods = refillFoods(allBodies(snakes), [], 0, rng);
  return {
    ...state,
    snakes,
    foods,
    shots: [],
    status: "countdown",
    countdown: MP_COUNTDOWN_START,
    matchRound: options.resetMatch ? 1 : state.matchRound + 1,
    winnerId: null,
    roundWinnerId: options.resetMatch ? null : state.roundWinnerId,
    seed,
    rngState: rng.state(),
    tick: 0,
    hostLeft: false,
    lastDeaths: options.resetMatch ? [] : state.lastDeaths,
    replay: [],
    replayIndex: 0,
  };
}

export function advanceCountdown(state: MpState): MpState {
  if (state.status !== "countdown") {
    return state;
  }
  if (state.countdown > 1) {
    return { ...state, countdown: state.countdown - 1 };
  }
  return { ...state, status: "playing", countdown: 0 };
}

export function startMp(state: MpState, seed = state.seed): MpState {
  const next = beginRound(state, seed, { resetMatch: true });
  if (next.status !== "countdown") {
    return next;
  }
  return { ...next, status: "playing", countdown: 0 };
}

export function queueMpInput(
  state: MpState,
  playerId: string,
  next: Direction,
): MpState {
  if (state.status !== "playing" && state.status !== "countdown") {
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
      return { ...snake, pending: next };
    }),
  };
}

export function queueMpFire(state: MpState, playerId: string): MpState {
  if (state.status !== "playing") {
    return state;
  }
  return {
    ...state,
    snakes: state.snakes.map((snake) => {
      if (snake.id !== playerId || !snake.alive) {
        return snake;
      }
      const affordable = Math.floor(snake.power / MP_POWER_COST);
      if (snake.queuedFires >= affordable) {
        return snake;
      }
      return { ...snake, queuedFires: snake.queuedFires + 1 };
    }),
  };
}

export function killPlayer(state: MpState, playerId: string): MpState {
  if (state.status !== "playing") {
    const snakes = state.snakes.filter((snake) => snake.id !== playerId);
    const next = { ...state, snakes };
    if (state.status === "countdown" && snakes.length < 2) {
      return { ...next, status: "over", winnerId: matchWinnerId(snakes) };
    }
    return next;
  }
  const snakes = state.snakes.map((snake) =>
    snake.id === playerId ? { ...snake, alive: false } : snake,
  );
  return resolveWinner({
    ...state,
    snakes,
    lastDeaths: [{ playerId, cause: "left", otherId: null }],
  });
}

export function markHostLeft(state: MpState): MpState {
  if (state.status === "lobby" || state.status === "countdown") {
    return { ...state, hostLeft: true, status: "over" };
  }
  if (state.status !== "playing") {
    return { ...state, hostLeft: true, status: "over" };
  }
  return resolveWinner({ ...state, hostLeft: true });
}

function matchWinnerId(snakes: MpSnake[]): string | null {
  const ranked = roundStandings(snakes);
  if (ranked.length === 0) {
    return null;
  }
  const top = ranked[0];
  const second = ranked[1];
  if (
    ranked.length > 1 &&
    second.roundWins === top.roundWins &&
    second.score === top.score
  ) {
    return null;
  }
  return top.id;
}

function finishRound(state: MpState, winnerId: string | null): MpState {
  const snakes = winnerId
    ? state.snakes.map((snake) =>
        snake.id === winnerId
          ? { ...snake, roundWins: snake.roundWins + 1 }
          : snake,
      )
    : state.snakes;
  const awarded: MpState = {
    ...state,
    snakes,
    winnerId,
    roundWinnerId: winnerId,
  };
  if (state.hostLeft || state.matchRound >= MP_ROUNDS) {
    return {
      ...awarded,
      status: "over",
      winnerId: matchWinnerId(snakes),
    };
  }
  const leftIds = new Set(
    state.lastDeaths
      .filter((death) => death.cause === "left")
      .map((death) => death.playerId),
  );
  const remaining = snakes.filter((snake) => !leftIds.has(snake.id));
  if (remaining.length < 2) {
    return {
      ...awarded,
      status: "over",
      winnerId: matchWinnerId(snakes),
    };
  }
  return beginRound({ ...awarded, snakes: remaining }, state.rngState, {
    resetMatch: false,
  });
}

function resolveWinner(state: MpState): MpState {
  if (state.hostLeft) {
    return {
      ...state,
      status: "over",
      winnerId: matchWinnerId(state.snakes),
    };
  }
  const alive = state.snakes.filter((snake) => snake.alive);
  const longEnough = alive
    .filter((snake) => snake.body.length >= MP_WIN_LENGTH)
    .sort((a, b) => {
      if (b.body.length !== a.body.length) {
        return b.body.length - a.body.length;
      }
      return b.score - a.score;
    });
  if (longEnough.length > 0) {
    return finishRound(state, longEnough[0].id);
  }
  if (alive.length > 1) {
    return state;
  }
  if (alive.length === 1 && state.snakes.length > 1) {
    return finishRound(state, alive[0].id);
  }
  return finishRound(state, null);
}

export function roundStandings(snakes: MpSnake[]): MpSnake[] {
  return snakes.slice().sort((a, b) => {
    if (b.roundWins !== a.roundWins) {
      return b.roundWins - a.roundWins;
    }
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.alive !== b.alive) {
      return a.alive ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

function chargePower(power: number, apples: number): number {
  return power + apples;
}

function inBounds(point: Point): boolean {
  return (
    point.x >= 0 &&
    point.x < MP_GRID_WIDTH &&
    point.y >= 0 &&
    point.y < MP_GRID_HEIGHT
  );
}

function resolveShot(
  shot: MpShot,
  snakes: MpSnake[],
  bodies: Map<string, Point[]>,
  foods: Point[],
  dying: Set<string>,
  deaths: Map<string, MpDeath>,
): { keep: boolean; foods: Point[]; appleOwner: string | null } {
  const here = { x: shot.x, y: shot.y };
  if (!inBounds(here)) {
    return { keep: false, foods, appleOwner: null };
  }

  const foodIndex = foods.findIndex((food) => pointsEqual(food, here));
  if (foodIndex >= 0) {
    return {
      keep: false,
      foods: foods.filter((_, index) => index !== foodIndex),
      appleOwner: shot.ownerId,
    };
  }

  for (const snake of snakes) {
    if (!snake.alive || dying.has(snake.id)) {
      const corpse = bodies.get(snake.id) ?? snake.body;
      if (corpse.some((segment) => pointsEqual(segment, here))) {
        return { keep: false, foods, appleOwner: null };
      }
      continue;
    }
    const body = bodies.get(snake.id) ?? snake.body;
    const hitIndex = body.findIndex((segment) => pointsEqual(segment, here));
    if (hitIndex < 0) {
      continue;
    }
    if (hitIndex === 0) {
      if (snake.id === shot.ownerId) {
        continue;
      }
      dying.add(snake.id);
      rememberDeath(deaths, snake.id, "shot", shot.ownerId);
      return { keep: false, foods, appleOwner: null };
    }
    const leftover = body.slice(0, hitIndex);
    if (leftover.length === 0) {
      dying.add(snake.id);
      rememberDeath(deaths, snake.id, "shot", shot.ownerId);
    } else {
      bodies.set(snake.id, leftover);
    }
    return { keep: false, foods, appleOwner: null };
  }

  return { keep: true, foods, appleOwner: null };
}

export function tickMp(state: MpState): MpState {
  if (state.status !== "playing") {
    return state;
  }

  const rng = createRng(state.rngState);
  const alive = state.snakes.filter((snake) => snake.alive);
  const nextHead = new Map<string, Point>();
  const nextDir = new Map<string, Direction>();
  const deaths = new Map<string, MpDeath>();
  const powerSpent = new Set<string>();
  const shotApples = new Map<string, number>();

  for (const snake of alive) {
    const dir =
      OPPOSITE[snake.direction] === snake.pending
        ? snake.direction
        : snake.pending;
    nextDir.set(snake.id, dir);
    const head = snake.body[0];
    const delta = DIRECTION_DELTA[dir];
    nextHead.set(snake.id, { x: head.x + delta.x, y: head.y + delta.y });
  }

  const dying = new Set<string>();
  const bodies = new Map(
    state.snakes.map((snake) => [
      snake.id,
      snake.body.map((point) => ({ ...point })),
    ]),
  );
  const spawned: MpShot[] = [];
  for (const snake of alive) {
    if (
      snake.queuedFires <= 0 ||
      snake.power < MP_POWER_COST ||
      snake.fireCooldown > 0
    ) {
      continue;
    }
    const dir = nextDir.get(snake.id) ?? snake.direction;
    const head = nextHead.get(snake.id) ?? snake.body[0];
    const delta = DIRECTION_DELTA[dir];
    spawned.push({
      ownerId: snake.id,
      x: head.x + delta.x,
      y: head.y + delta.y,
      direction: dir,
    });
    powerSpent.add(snake.id);
  }

  const traveling = state.shots.map((shot) => {
    const delta = DIRECTION_DELTA[shot.direction];
    return {
      ownerId: shot.ownerId,
      x: shot.x + delta.x,
      y: shot.y + delta.y,
      direction: shot.direction,
    };
  });

  let foods = [...state.foods];
  const liveShots: MpShot[] = [];
  for (const shot of [...traveling, ...spawned]) {
    const resolved = resolveShot(
      shot,
      state.snakes,
      bodies,
      foods,
      dying,
      deaths,
    );
    foods = resolved.foods;
    if (resolved.appleOwner) {
      shotApples.set(
        resolved.appleOwner,
        (shotApples.get(resolved.appleOwner) ?? 0) + 1,
      );
    }
    if (resolved.keep) {
      liveShots.push(shot);
    }
  }

  for (const id of dying) {
    nextHead.delete(id);
  }

  const byCell = new Map<string, string[]>();
  for (const [id, head] of nextHead) {
    if (dying.has(id)) {
      continue;
    }
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
          "head",
          ids.find((other) => other !== id) ?? null,
        );
      }
    }
  }

  for (let i = 0; i < alive.length; i += 1) {
    for (let j = i + 1; j < alive.length; j += 1) {
      const a = alive[i];
      const b = alive[j];
      if (dying.has(a.id) || dying.has(b.id)) {
        continue;
      }
      const headA = nextHead.get(a.id);
      const headB = nextHead.get(b.id);
      if (!headA || !headB) {
        continue;
      }
      if (pointsEqual(headA, b.body[0]) && pointsEqual(headB, a.body[0])) {
        dying.add(a.id);
        dying.add(b.id);
        rememberDeath(deaths, a.id, "head", b.id);
        rememberDeath(deaths, b.id, "head", a.id);
      }
    }
  }

  const foodCells = occupancySet(foods);
  const eating = new Set<string>();
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
    const cut = bodies.get(snake.id) ?? snake.body;
    const clipped = cut.length !== snake.body.length && !dying.has(snake.id);
    const segments = clipped ? cut : snake.body;
    const skipTail =
      snake.alive &&
      !dying.has(snake.id) &&
      !eating.has(snake.id) &&
      segments.length > 0;
    const body = skipTail ? segments.slice(0, -1) : segments;
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
      rememberDeath(deaths, snake.id, "wall");
      continue;
    }
    if (!inBounds(head)) {
      dying.add(snake.id);
      rememberDeath(deaths, snake.id, "wall");
      continue;
    }
    if (occupied.has(cellKey(head))) {
      dying.add(snake.id);
      const owner = bodyOwner(state.snakes, head);
      if (!owner || owner.id === snake.id) {
        rememberDeath(deaths, snake.id, "self");
      } else {
        rememberDeath(deaths, snake.id, "body", owner.id);
      }
    }
  }

  for (let i = liveShots.length - 1; i >= 0; i -= 1) {
    const shot = liveShots[i];
    for (const snake of alive) {
      if (dying.has(snake.id) || snake.id === shot.ownerId) {
        continue;
      }
      const head = nextHead.get(snake.id);
      if (head && pointsEqual(head, shot)) {
        dying.add(snake.id);
        rememberDeath(deaths, snake.id, "shot", shot.ownerId);
        liveShots.splice(i, 1);
        break;
      }
    }
  }

  for (const id of dying) {
    eating.delete(id);
  }

  const snakes = state.snakes.map((snake) => {
    const apples =
      (eating.has(snake.id) ? 1 : 0) + (shotApples.get(snake.id) ?? 0);
    const fired = powerSpent.has(snake.id);
    const powerBase = fired
      ? Math.max(0, snake.power - MP_POWER_COST)
      : snake.power;
    const queuedFires = fired
      ? Math.max(0, snake.queuedFires - 1)
      : snake.queuedFires;
    const fireCooldown = fired
      ? MP_FIRE_COOLDOWN
      : Math.max(0, snake.fireCooldown - 1);
    if (!snake.alive) {
      return { ...snake, queuedFires: 0, fireCooldown: 0 };
    }
    if (dying.has(snake.id)) {
      return {
        ...snake,
        alive: false,
        queuedFires: 0,
        fireCooldown: 0,
        power: chargePower(powerBase, apples),
        score: snake.score + apples * SCORE_PER_FOOD,
      };
    }
    const leftover = bodies.get(snake.id) ?? snake.body;
    const clipped = leftover.length !== snake.body.length;
    const base = leftover;
    const lost = clipped ? snake.body.length - leftover.length : 0;
    const dir = nextDir.get(snake.id) ?? snake.direction;
    const head = nextHead.get(snake.id);
    if (!head) {
      return { ...snake, alive: false, queuedFires: 0, fireCooldown: 0 };
    }
    const ate = eating.has(snake.id);
    const body = ate ? [head, ...base] : [head, ...base.slice(0, -1)];
    return {
      ...snake,
      body,
      direction: dir,
      pending: dir,
      queuedFires,
      fireCooldown,
      score: Math.max(
        0,
        snake.score - lost * SCORE_PER_FOOD + apples * SCORE_PER_FOOD,
      ),
      power: chargePower(powerBase, apples),
    };
  });

  const eatenHeads = new Set<string>();
  for (const id of eating) {
    const head = nextHead.get(id);
    if (head) {
      eatenHeads.add(cellKey(head));
    }
  }
  const remainingFoods = foods.filter((food) => !eatenHeads.has(cellKey(food)));
  const maxScore = Math.max(0, ...snakes.map((snake) => snake.score));
  const nextFoods =
    remainingFoods.length >= baitCountForScore(maxScore)
      ? remainingFoods
      : refillFoods(allBodies(snakes), remainingFoods, maxScore, rng);

  return resolveWinner({
    ...state,
    snakes,
    foods: nextFoods,
    shots: liveShots,
    rngState: rng.state(),
    tick: state.tick + 1,
    lastDeaths: deaths.size > 0 ? [...deaths.values()] : state.lastDeaths,
  });
}
