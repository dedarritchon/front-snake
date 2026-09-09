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
export const MP_TURBO_TICKS = Math.round(1000 / MP_TICK_MS);
export const MP_BOMB_FUSE_TICKS = Math.round(3000 / MP_TICK_MS);
export const MP_BLAST_TICKS = 3;
export const MP_ROUNDS = 10;
export const MP_WIN_LENGTH = 20;
export const MP_COUNTDOWN_MS = 1000;
export const MP_COUNTDOWN_START = 3;

export type MpStatus = "lobby" | "countdown" | "playing" | "replay" | "over";
export type MpDeathCause =
  | "wall"
  | "self"
  | "body"
  | "head"
  | "left"
  | "shot"
  | "bomb";

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

export interface MpBomb {
  ownerId: string;
  x: number;
  y: number;
  fuse: number;
}

export interface MpBlast {
  x: number;
  y: number;
  life: number;
}

export interface MpSnapshot {
  snakes: MpSnake[];
  foods: Point[];
  shots: MpShot[];
  bombs: MpBomb[];
  blasts: MpBlast[];
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
  queuedTurbo: number;
  queuedBombs: number;
  turboLeft: number;
  headingHold: number;
  roundWins: number;
}

export interface MpState {
  snakes: MpSnake[];
  foods: Point[];
  shots: MpShot[];
  bombs: MpBomb[];
  blasts: MpBlast[];
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

function chebyshev(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function cellCode(point: Point): number {
  return point.x * 1024 + point.y;
}

const GRID_CELLS = MP_GRID_WIDTH * MP_GRID_HEIGHT;
const OCC = new Uint8Array(GRID_CELLS);

function gridIndex(point: Point): number {
  return point.y * MP_GRID_WIDTH + point.x;
}

function markOcc(point: Point): void {
  if (
    point.x >= 0 &&
    point.x < MP_GRID_WIDTH &&
    point.y >= 0 &&
    point.y < MP_GRID_HEIGHT
  ) {
    OCC[gridIndex(point)] = 1;
  }
}

function hasOcc(point: Point): boolean {
  if (
    point.x < 0 ||
    point.x >= MP_GRID_WIDTH ||
    point.y < 0 ||
    point.y >= MP_GRID_HEIGHT
  ) {
    return false;
  }
  return OCC[gridIndex(point)] === 1;
}

function allBodies(snakes: MpSnake[]): Point[] {
  return snakes.flatMap((snake) => snake.body);
}

function occupancySet(points: Point[]): Set<number> {
  const occupied = new Set<number>();
  for (const point of points) {
    occupied.add(cellCode(point));
  }
  return occupied;
}

function spawnMpFood(rng: Rng): Point | null {
  let free = 0;
  for (const occupied of OCC) {
    if (occupied === 0) {
      free += 1;
    }
  }
  if (free === 0) {
    return null;
  }
  let pick = rng.nextInt(free);
  for (let y = 0; y < MP_GRID_HEIGHT; y += 1) {
    for (let x = 0; x < MP_GRID_WIDTH; x += 1) {
      if (OCC[y * MP_GRID_WIDTH + x] === 0) {
        if (pick === 0) {
          return { x, y };
        }
        pick -= 1;
      }
    }
  }
  return null;
}

function spawnMpFoods(
  count: number,
  occupied: Point[],
  existing: Point[],
  rng: Rng,
): Point[] {
  const foods = [...existing];
  OCC.fill(0);
  for (const point of occupied) {
    markOcc(point);
  }
  for (const food of foods) {
    markOcc(food);
  }
  while (foods.length < count) {
    const next = spawnMpFood(rng);
    if (!next) {
      break;
    }
    foods.push(next);
    markOcc(next);
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
    bombs: state.bombs.map((bomb) => ({ ...bomb })),
    blasts: state.blasts.map((blast) => ({ ...blast })),
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
  if (host.tick === local.tick && mine.queuedTurbo > 0) {
    next = {
      ...next,
      snakes: next.snakes.map((snake) =>
        snake.id === playerId
          ? {
              ...snake,
              queuedTurbo: Math.max(snake.queuedTurbo, mine.queuedTurbo),
            }
          : snake,
      ),
    };
  }
  if (host.tick === local.tick && mine.queuedBombs > 0) {
    next = {
      ...next,
      snakes: next.snakes.map((snake) =>
        snake.id === playerId
          ? {
              ...snake,
              queuedBombs: Math.max(snake.queuedBombs, mine.queuedBombs),
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
  queuedTurbo?: number;
  queuedBombs?: number;
  turboLeft?: number;
  headingHold?: number;
  roundWins?: number;
}

interface MpWireSnapshot {
  snakes: MpWireSnake[];
  foods: number[];
  shots: MpShot[];
  bombs?: MpBomb[];
  blasts?: MpBlast[];
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
  bombs?: MpBomb[];
  blasts?: MpBlast[];
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
  if (snake.queuedTurbo > 0) {
    packed.queuedTurbo = snake.queuedTurbo;
  }
  if (snake.queuedBombs > 0) {
    packed.queuedBombs = snake.queuedBombs;
  }
  if (snake.turboLeft > 0) {
    packed.turboLeft = snake.turboLeft;
  }
  if (snake.headingHold > 0) {
    packed.headingHold = snake.headingHold;
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
    queuedTurbo:
      typeof row.queuedTurbo === "number"
        ? Math.max(0, Math.floor(row.queuedTurbo))
        : 0,
    queuedBombs:
      typeof row.queuedBombs === "number"
        ? Math.max(0, Math.floor(row.queuedBombs))
        : 0,
    turboLeft:
      typeof row.turboLeft === "number"
        ? Math.max(0, Math.floor(row.turboLeft))
        : 0,
    headingHold:
      typeof row.headingHold === "number"
        ? Math.max(0, Math.floor(row.headingHold))
        : 0,
    roundWins:
      typeof row.roundWins === "number"
        ? Math.max(0, Math.floor(row.roundWins))
        : 0,
  };
}

function unpackBombs(value: unknown): MpBomb[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const bombs: MpBomb[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const row = item as {
      ownerId?: unknown;
      x?: unknown;
      y?: unknown;
      fuse?: unknown;
    };
    if (
      typeof row.ownerId !== "string" ||
      typeof row.x !== "number" ||
      typeof row.y !== "number" ||
      typeof row.fuse !== "number"
    ) {
      continue;
    }
    bombs.push({
      ownerId: row.ownerId,
      x: row.x,
      y: row.y,
      fuse: Math.max(0, Math.floor(row.fuse)),
    });
  }
  return bombs;
}

function unpackBlasts(value: unknown): MpBlast[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const blasts: MpBlast[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const row = item as { x?: unknown; y?: unknown; life?: unknown };
    if (
      typeof row.x !== "number" ||
      typeof row.y !== "number" ||
      typeof row.life !== "number"
    ) {
      continue;
    }
    blasts.push({
      x: row.x,
      y: row.y,
      life: Math.max(0, Math.floor(row.life)),
    });
  }
  return blasts;
}

function packSnapshot(snapshot: MpSnapshot): MpWireSnapshot {
  const packed: MpWireSnapshot = {
    snakes: snapshot.snakes.map(packSnake),
    foods: packPoints(snapshot.foods),
    shots: snapshot.shots,
  };
  if (snapshot.bombs.length > 0) {
    packed.bombs = snapshot.bombs;
  }
  if (snapshot.blasts.length > 0) {
    packed.blasts = snapshot.blasts;
  }
  return packed;
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
  return {
    snakes,
    foods,
    shots: Array.isArray(row.shots) ? (row.shots as MpShot[]) : [],
    bombs: unpackBombs(row.bombs),
    blasts: unpackBlasts(row.blasts),
  };
}

export function createPackedSnapshotRing(capacity = MP_REPLAY_FRAMES) {
  const slots: (MpWireSnapshot | undefined)[] = Array.from({
    length: capacity,
  });
  let start = 0;
  let size = 0;
  return {
    clear() {
      start = 0;
      size = 0;
    },
    push(state: MpState) {
      const packed = packSnapshot({
        snakes: state.snakes,
        foods: state.foods,
        shots: state.shots,
        bombs: state.bombs,
        blasts: state.blasts,
      });
      if (size < capacity) {
        slots[(start + size) % capacity] = packed;
        size += 1;
        return;
      }
      slots[start] = packed;
      start = (start + 1) % capacity;
    },
    unpack(): MpSnapshot[] {
      const frames: MpSnapshot[] = [];
      for (let i = 0; i < size; i += 1) {
        const packed = slots[(start + i) % capacity];
        if (!packed) {
          continue;
        }
        const snapshot = unpackSnapshot(packed);
        if (snapshot) {
          frames.push(snapshot);
        }
      }
      return frames;
    },
  };
}

export function retainReplay(
  incoming: MpState,
  previous: MpState | null,
): MpState {
  if (
    incoming.status === "over" &&
    incoming.replay.length === 0 &&
    previous &&
    previous.replay.length > 0
  ) {
    return { ...incoming, replay: previous.replay };
  }
  return incoming;
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

export function toWireState(
  state: MpState,
  options?: { includeReplay?: boolean },
): MpWireState {
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
  if (state.bombs.length > 0) {
    wire.bombs = state.bombs;
  }
  if (state.blasts.length > 0) {
    wire.blasts = state.blasts;
  }
  if (state.lastDeaths.length > 0) {
    wire.lastDeaths = state.lastDeaths;
  }
  if (
    (options?.includeReplay ?? true) &&
    state.status === "over" &&
    state.replay.length > 0
  ) {
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
  const bombs = unpackBombs(row.bombs);
  const blasts = unpackBlasts(row.blasts);
  const lastDeaths = Array.isArray(row.lastDeaths)
    ? (row.lastDeaths as MpDeath[])
    : [];
  return {
    snakes,
    foods,
    shots,
    bombs,
    blasts,
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
    bombs: first.bombs,
    blasts: first.blasts,
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
    bombs: frame.bombs,
    blasts: frame.blasts,
  };
}

export function describeDeaths(deaths: MpDeath[], snakes: MpSnake[]): string {
  const nameOf = (id: string): string =>
    snakes.find((snake) => snake.id === id)?.name ?? "Player";
  const headDeaths = new Set(
    deaths
      .filter((death) => death.cause === "head")
      .map((death) => death.playerId),
  );
  const lines: string[] = [];
  const seenHead = new Set<string>();
  for (const death of deaths) {
    if (death.cause === "head" && death.otherId) {
      const key = [death.playerId, death.otherId].sort().join(":");
      if (seenHead.has(key)) {
        continue;
      }
      seenHead.add(key);
      if (headDeaths.has(death.otherId)) {
        lines.push(
          `${nameOf(death.playerId)} and ${nameOf(death.otherId)} crashed`,
        );
      } else {
        lines.push(
          `${nameOf(death.playerId)} ran into ${nameOf(death.otherId)}`,
        );
      }
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
    if (death.cause === "bomb") {
      if (death.otherId && death.otherId !== death.playerId) {
        lines.push(
          `${nameOf(death.otherId)} bombed ${nameOf(death.playerId)}`,
        );
      } else {
        lines.push(`${nameOf(death.playerId)} blew up`);
      }
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
      queuedTurbo: 0,
      queuedBombs: 0,
      turboLeft: 0,
      headingHold: 0,
      roundWins: 0,
    };
  });

  return {
    snakes,
    foods: [],
    shots: [],
    bombs: [],
    blasts: [],
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
      queuedTurbo: 0,
      queuedBombs: 0,
      turboLeft: 0,
      headingHold: 0,
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
    bombs: [],
    blasts: [],
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

function queuedSpendSlots(snake: MpSnake): number {
  return snake.queuedFires + snake.queuedTurbo + snake.queuedBombs;
}

function deadQueues(): Pick<
  MpSnake,
  "queuedFires" | "queuedTurbo" | "queuedBombs" | "turboLeft" | "fireCooldown"
> {
  return {
    queuedFires: 0,
    queuedTurbo: 0,
    queuedBombs: 0,
    turboLeft: 0,
    fireCooldown: 0,
  };
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
      if (queuedSpendSlots(snake) >= affordable) {
        return snake;
      }
      return { ...snake, queuedFires: snake.queuedFires + 1 };
    }),
  };
}

export function queueMpTurbo(state: MpState, playerId: string): MpState {
  if (state.status !== "playing") {
    return state;
  }
  return {
    ...state,
    snakes: state.snakes.map((snake) => {
      if (snake.id !== playerId || !snake.alive) {
        return snake;
      }
      if (snake.turboLeft > 0 || snake.queuedTurbo > 0) {
        return snake;
      }
      const affordable = Math.floor(snake.power / MP_POWER_COST);
      if (queuedSpendSlots(snake) >= affordable) {
        return snake;
      }
      return { ...snake, queuedTurbo: 1 };
    }),
  };
}

export function queueMpBomb(state: MpState, playerId: string): MpState {
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
      if (queuedSpendSlots(snake) >= affordable) {
        return snake;
      }
      return { ...snake, queuedBombs: snake.queuedBombs + 1 };
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

function wrapCell(point: Point): Point {
  return {
    x: ((point.x % MP_GRID_WIDTH) + MP_GRID_WIDTH) % MP_GRID_WIDTH,
    y: ((point.y % MP_GRID_HEIGHT) + MP_GRID_HEIGHT) % MP_GRID_HEIGHT,
  };
}

function addCombat(
  combatScore: Map<string, number>,
  ownerId: string,
  cells: number,
): void {
  if (cells <= 0) {
    return;
  }
  combatScore.set(
    ownerId,
    (combatScore.get(ownerId) ?? 0) + cells * SCORE_PER_FOOD,
  );
}

function remainingLength(snake: MpSnake, bodies: Map<string, Point[]>): number {
  const cut = bodies.get(snake.id);
  if (cut && cut.length !== snake.body.length) {
    return cut.length;
  }
  return snake.body.length;
}

function headingHoldThisTick(snake: MpSnake, dir: Direction): number {
  return dir !== snake.direction ? 0 : snake.headingHold;
}

function nextHeadingHold(snake: MpSnake, dir: Direction): number {
  return dir !== snake.direction ? 0 : snake.headingHold + 1;
}

function decideHeadPair(
  a: MpSnake,
  b: MpSnake,
  nextDir: Map<string, Direction>,
  dying: Set<string>,
  deaths: Map<string, MpDeath>,
  combatScore: Map<string, number>,
  lengthOf: (snake: MpSnake) => number,
): void {
  const dirA = nextDir.get(a.id) ?? a.direction;
  const dirB = nextDir.get(b.id) ?? b.direction;
  const holdA = headingHoldThisTick(a, dirA);
  const holdB = headingHoldThisTick(b, dirB);
  if (holdA === holdB) {
    dying.add(a.id);
    dying.add(b.id);
    rememberDeath(deaths, a.id, "head", b.id);
    rememberDeath(deaths, b.id, "head", a.id);
    return;
  }
  const winner = holdA > holdB ? a : b;
  const loser = holdA > holdB ? b : a;
  dying.add(loser.id);
  rememberDeath(deaths, loser.id, "head", winner.id);
  addCombat(combatScore, winner.id, lengthOf(loser));
}

function applyHeadCollisions(
  movers: MpSnake[],
  nextHead: Map<string, Point>,
  nextDir: Map<string, Direction>,
  dying: Set<string>,
  deaths: Map<string, MpDeath>,
  combatScore: Map<string, number>,
  lengthOf: (snake: MpSnake) => number,
): void {
  const byId = new Map(movers.map((snake) => [snake.id, snake]));
  const byCell = new Map<number, string[]>();
  for (const [id, head] of nextHead) {
    if (dying.has(id)) {
      continue;
    }
    const key = cellCode(head);
    const list = byCell.get(key) ?? [];
    list.push(id);
    byCell.set(key, list);
  }
  for (const ids of byCell.values()) {
    if (ids.length < 2) {
      continue;
    }
    if (ids.length > 2) {
      for (const id of ids) {
        dying.add(id);
        rememberDeath(
          deaths,
          id,
          "head",
          ids.find((other) => other !== id) ?? null,
        );
      }
      continue;
    }
    const a = byId.get(ids[0]);
    const b = byId.get(ids[1]);
    if (!a || !b) {
      continue;
    }
    decideHeadPair(a, b, nextDir, dying, deaths, combatScore, lengthOf);
  }

  for (let i = 0; i < movers.length; i += 1) {
    for (let j = i + 1; j < movers.length; j += 1) {
      const a = movers[i];
      const b = movers[j];
      if (dying.has(a.id) || dying.has(b.id)) {
        continue;
      }
      const headA = nextHead.get(a.id);
      const headB = nextHead.get(b.id);
      if (!headA || !headB) {
        continue;
      }
      if (pointsEqual(headA, b.body[0]) && pointsEqual(headB, a.body[0])) {
        decideHeadPair(a, b, nextDir, dying, deaths, combatScore, lengthOf);
      }
    }
  }
}

function resolveShot(
  shot: MpShot,
  snakes: MpSnake[],
  bodies: Map<string, Point[]>,
  foods: Point[],
  dying: Set<string>,
  deaths: Map<string, MpDeath>,
  combatScore: Map<string, number>,
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
      addCombat(combatScore, shot.ownerId, body.length);
      return { keep: false, foods, appleOwner: null };
    }
    const leftover = body.slice(0, hitIndex);
    const lost = body.length - leftover.length;
    if (leftover.length === 0) {
      dying.add(snake.id);
      rememberDeath(deaths, snake.id, "shot", shot.ownerId);
      addCombat(combatScore, shot.ownerId, body.length);
    } else {
      bodies.set(snake.id, leftover);
      addCombat(combatScore, shot.ownerId, lost);
    }
    return { keep: false, foods, appleOwner: null };
  }

  return { keep: true, foods, appleOwner: null };
}

function extraTurboStep(
  snakes: MpSnake[],
  foods: Point[],
  shots: MpShot[],
): {
  snakes: MpSnake[];
  foods: Point[];
  shots: MpShot[];
  deaths: MpDeath[];
} {
  const turbo = snakes.filter((snake) => snake.alive && snake.turboLeft > 0);
  if (turbo.length === 0) {
    return { snakes, foods, shots, deaths: [] };
  }

  const combatScore = new Map<string, number>();

  const deaths = new Map<string, MpDeath>();
  const dying = new Set<string>();
  const nextHead = new Map<string, Point>();
  const nextDir = new Map<string, Direction>();

  for (const snake of turbo) {
    const dir =
      OPPOSITE[snake.direction] === snake.pending
        ? snake.direction
        : snake.pending;
    nextDir.set(snake.id, dir);
    const head = snake.body[0];
    const delta = DIRECTION_DELTA[dir];
    nextHead.set(
      snake.id,
      wrapCell({ x: head.x + delta.x, y: head.y + delta.y }),
    );
  }

  applyHeadCollisions(
    turbo,
    nextHead,
    nextDir,
    dying,
    deaths,
    combatScore,
    (snake) => snake.body.length,
  );

  let nextFoods = [...foods];
  const foodCells = occupancySet(nextFoods);
  const eating = new Set<string>();
  for (const snake of turbo) {
    if (dying.has(snake.id)) {
      continue;
    }
    const head = nextHead.get(snake.id);
    if (head && foodCells.has(cellCode(head))) {
      eating.add(snake.id);
    }
  }

  OCC.fill(0);
  for (const snake of snakes) {
    if (!snake.alive || dying.has(snake.id)) {
      continue;
    }
    const turboMove = turbo.some((row) => row.id === snake.id);
    const skipTail =
      turboMove && !eating.has(snake.id) && snake.body.length > 0;
    const body = skipTail ? snake.body.slice(0, -1) : snake.body;
    for (const point of body) {
      markOcc(point);
    }
  }

  for (const snake of turbo) {
    if (dying.has(snake.id)) {
      continue;
    }
    const head = nextHead.get(snake.id);
    if (!head || !inBounds(head)) {
      dying.add(snake.id);
      rememberDeath(deaths, snake.id, "wall");
      continue;
    }
    if (hasOcc(head)) {
      dying.add(snake.id);
      const owner = bodyOwner(snakes, head);
      if (!owner || owner.id === snake.id) {
        rememberDeath(deaths, snake.id, "self");
      } else {
        rememberDeath(deaths, snake.id, "body", owner.id);
        addCombat(combatScore, owner.id, snake.body.length);
      }
    }
  }

  const liveShots = [...shots];
  for (let i = liveShots.length - 1; i >= 0; i -= 1) {
    const shot = liveShots[i];
    for (const snake of turbo) {
      if (dying.has(snake.id) || snake.id === shot.ownerId) {
        continue;
      }
      const head = nextHead.get(snake.id);
      if (head && pointsEqual(head, shot)) {
        dying.add(snake.id);
        rememberDeath(deaths, snake.id, "shot", shot.ownerId);
        addCombat(combatScore, shot.ownerId, snake.body.length);
        liveShots.splice(i, 1);
        break;
      }
    }
  }

  for (const id of dying) {
    eating.delete(id);
  }

  const eatenHeads = new Set<number>();
  for (const id of eating) {
    const head = nextHead.get(id);
    if (head) {
      eatenHeads.add(cellCode(head));
    }
  }
  nextFoods = nextFoods.filter((food) => !eatenHeads.has(cellCode(food)));

  const nextSnakes = snakes.map((snake) => {
    const apples = eating.has(snake.id) ? 1 : 0;
    if (!snake.alive) {
      return snake;
    }
    if (dying.has(snake.id)) {
      return {
        ...snake,
        alive: false,
        ...deadQueues(),
        power: chargePower(snake.power, apples),
        score: snake.score + apples * SCORE_PER_FOOD,
      };
    }
    if (!nextHead.has(snake.id)) {
      return snake;
    }
    const dir = nextDir.get(snake.id) ?? snake.direction;
    const head = nextHead.get(snake.id);
    if (!head) {
      return snake;
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
      score: snake.score + apples * SCORE_PER_FOOD,
      power: chargePower(snake.power, apples),
    };
  });

  const withCombat = nextSnakes.map((snake) => {
    const bonus = combatScore.get(snake.id) ?? 0;
    if (bonus === 0) {
      return snake;
    }
    return { ...snake, score: snake.score + bonus };
  });

  return {
    snakes: withCombat,
    foods: nextFoods,
    shots: liveShots,
    deaths: [...deaths.values()],
  };
}

function tickBombs(
  bombs: MpBomb[],
  snakes: MpSnake[],
  deaths: Map<string, MpDeath>,
): { bombs: MpBomb[]; snakes: MpSnake[]; blasts: MpBlast[] } {
  const nextBombs: MpBomb[] = [];
  const blasts: MpBlast[] = [];
  const dying = new Set<string>();
  for (const bomb of bombs) {
    const fuse = bomb.fuse - 1;
    if (fuse > 0) {
      nextBombs.push({ ...bomb, fuse });
      continue;
    }
    blasts.push({ x: bomb.x, y: bomb.y, life: MP_BLAST_TICKS });
    for (const snake of snakes) {
      if (!snake.alive || dying.has(snake.id)) {
        continue;
      }
      if (snake.body.some((segment) => chebyshev(segment, bomb) <= 1)) {
        dying.add(snake.id);
        rememberDeath(deaths, snake.id, "bomb", bomb.ownerId);
      }
    }
  }
  if (dying.size === 0) {
    return { bombs: nextBombs, snakes, blasts };
  }
  return {
    bombs: nextBombs,
    blasts,
    snakes: snakes.map((snake) =>
      dying.has(snake.id)
        ? { ...snake, alive: false, ...deadQueues() }
        : snake,
    ),
  };
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
  const firedIds = new Set<string>();
  const turboStarted = new Set<string>();
  const plantedIds = new Set<string>();
  const shotApples = new Map<string, number>();
  const combatScore = new Map<string, number>();
  const bombs = state.bombs.map((bomb) => ({ ...bomb }));

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
  const bodies = new Map<string, Point[]>();
  const spawned: MpShot[] = [];
  for (const snake of alive) {
    let charges = Math.floor(snake.power / MP_POWER_COST);
    const willFire =
      snake.queuedFires > 0 && snake.fireCooldown <= 0 && charges > 0;
    if (willFire) {
      charges -= 1;
    }
    if (snake.queuedTurbo > 0 && snake.turboLeft <= 0 && charges > 0) {
      turboStarted.add(snake.id);
      charges -= 1;
    }
    if (snake.turboLeft > 0 || turboStarted.has(snake.id)) {
      const head = nextHead.get(snake.id);
      if (head) {
        nextHead.set(snake.id, wrapCell(head));
      }
    }
    if (willFire) {
      const dir = nextDir.get(snake.id) ?? snake.direction;
      const head = nextHead.get(snake.id) ?? snake.body[0];
      const delta = DIRECTION_DELTA[dir];
      spawned.push({
        ownerId: snake.id,
        x: head.x + delta.x,
        y: head.y + delta.y,
        direction: dir,
      });
      firedIds.add(snake.id);
    }
    if (snake.queuedBombs > 0 && charges > 0 && snake.body.length > 0) {
      const tail = snake.body[snake.body.length - 1];
      bombs.push({
        ownerId: snake.id,
        x: tail.x,
        y: tail.y,
        fuse: MP_BOMB_FUSE_TICKS,
      });
      plantedIds.add(snake.id);
      charges -= 1;
    }
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
      combatScore,
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

  applyHeadCollisions(
    alive,
    nextHead,
    nextDir,
    dying,
    deaths,
    combatScore,
    (snake) => remainingLength(snake, bodies),
  );

  const foodCells = occupancySet(foods);
  const eating = new Set<string>();
  for (const snake of alive) {
    if (dying.has(snake.id)) {
      continue;
    }
    const head = nextHead.get(snake.id);
    if (head && foodCells.has(cellCode(head))) {
      eating.add(snake.id);
    }
  }

  OCC.fill(0);
  for (const snake of state.snakes) {
    if (!snake.alive || dying.has(snake.id)) {
      continue;
    }
    const cut = bodies.get(snake.id) ?? snake.body;
    const clipped = cut.length !== snake.body.length;
    const segments = clipped ? cut : snake.body;
    const skipTail = !eating.has(snake.id) && segments.length > 0;
    const body = skipTail ? segments.slice(0, -1) : segments;
    for (const point of body) {
      markOcc(point);
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
    if (hasOcc(head)) {
      dying.add(snake.id);
      const owner = bodyOwner(state.snakes, head);
      if (!owner || owner.id === snake.id) {
        rememberDeath(deaths, snake.id, "self");
      } else {
        rememberDeath(deaths, snake.id, "body", owner.id);
        addCombat(combatScore, owner.id, remainingLength(snake, bodies));
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
        addCombat(combatScore, shot.ownerId, remainingLength(snake, bodies));
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
    const fired = firedIds.has(snake.id);
    const boosted = turboStarted.has(snake.id) && !dying.has(snake.id);
    const planted = plantedIds.has(snake.id);
    let spend = 0;
    if (fired) {
      spend += MP_POWER_COST;
    }
    if (boosted) {
      spend += MP_POWER_COST;
    }
    if (planted) {
      spend += MP_POWER_COST;
    }
    const powerBase = Math.max(0, snake.power - spend);
    const queuedFires = fired
      ? Math.max(0, snake.queuedFires - 1)
      : snake.queuedFires;
    const fireCooldown = fired
      ? MP_FIRE_COOLDOWN
      : Math.max(0, snake.fireCooldown - 1);
    const queuedBombs = planted
      ? Math.max(0, snake.queuedBombs - 1)
      : snake.queuedBombs;
    const combat = combatScore.get(snake.id) ?? 0;
    if (!snake.alive) {
      return {
        ...snake,
        ...deadQueues(),
      };
    }
    if (dying.has(snake.id)) {
      return {
        ...snake,
        alive: false,
        ...deadQueues(),
        power: chargePower(powerBase, apples),
        score: snake.score + apples * SCORE_PER_FOOD + combat,
      };
    }
    const leftover = bodies.get(snake.id) ?? snake.body;
    const clipped = leftover.length !== snake.body.length;
    const base = leftover;
    const lost = clipped ? snake.body.length - leftover.length : 0;
    const dir = nextDir.get(snake.id) ?? snake.direction;
    const head = nextHead.get(snake.id);
    if (!head) {
      return {
        ...snake,
        alive: false,
        ...deadQueues(),
      };
    }
    const ate = eating.has(snake.id);
    const body = ate ? [head, ...base] : [head, ...base.slice(0, -1)];
    const turboLeft = boosted ? MP_TURBO_TICKS : snake.turboLeft;
    const queuedTurbo = boosted ? 0 : snake.queuedTurbo;
    return {
      ...snake,
      body,
      direction: dir,
      pending: dir,
      headingHold: nextHeadingHold(snake, dir),
      queuedFires,
      fireCooldown,
      queuedTurbo,
      queuedBombs,
      turboLeft,
      score: Math.max(
        0,
        snake.score - lost * SCORE_PER_FOOD + apples * SCORE_PER_FOOD + combat,
      ),
      power: chargePower(powerBase, apples),
    };
  });

  const eatenHeads = new Set<number>();
  for (const id of eating) {
    const head = nextHead.get(id);
    if (head) {
      eatenHeads.add(cellCode(head));
    }
  }
  const remainingFoods = foods.filter(
    (food) => !eatenHeads.has(cellCode(food)),
  );

  const boosted = extraTurboStep(snakes, remainingFoods, liveShots);
  const cooled = boosted.snakes.map((snake) => ({
    ...snake,
    turboLeft: snake.alive && snake.turboLeft > 0 ? snake.turboLeft - 1 : 0,
  }));
  const deathMap = new Map<string, MpDeath>();
  for (const death of [...deaths.values(), ...boosted.deaths]) {
    deathMap.set(death.playerId, death);
  }
  const afterBombs = tickBombs(bombs, cooled, deathMap);
  const agedBlasts = state.blasts
    .map((blast) => ({ ...blast, life: blast.life - 1 }))
    .filter((blast) => blast.life > 0);
  const lastDeaths =
    deathMap.size > 0 ? [...deathMap.values()] : state.lastDeaths;
  const maxScore = Math.max(0, ...afterBombs.snakes.map((snake) => snake.score));
  const nextFoods =
    boosted.foods.length >= baitCountForScore(maxScore)
      ? boosted.foods
      : refillFoods(allBodies(afterBombs.snakes), boosted.foods, maxScore, rng);

  return resolveWinner({
    ...state,
    snakes: afterBombs.snakes,
    foods: nextFoods,
    shots: boosted.shots,
    bombs: afterBombs.bombs,
    blasts: [...agedBlasts, ...afterBombs.blasts],
    rngState: rng.state(),
    tick: state.tick + 1,
    lastDeaths,
  });
}
