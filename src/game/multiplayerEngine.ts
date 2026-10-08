import {
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
export const MP_REPLAY_TICK_MS = MP_TICK_MS * 3;
export const MP_REPLAY_FRAMES = 18;
export const MP_GRID_WIDTH = 29;
export const MP_GRID_HEIGHT = 25;
export const MP_COLORS = SNAKE_COLORS;
export const MP_POWER_COST = 3;
export const MP_START_POWER = MP_POWER_COST;
export const MP_FIRE_COOLDOWN = 2;
export const MP_TURBO_TICKS = Math.round(1000 / MP_TICK_MS);
export const MP_BOMB_FUSE_TICKS = Math.round(3000 / MP_TICK_MS);
export const MP_BLAST_TICKS = 3;
export const MP_BLAST_RADIUS = 2;
export const MP_ROUNDS = 10;
export const MP_WINS_NEEDED = 3;
export const MP_WIN_LENGTH = 20;
export const MP_SHOT_STEP = 1;
export const MP_CORPSE_TICKS = Math.round(3000 / MP_TICK_MS);
export const MP_HUMILIATION_TICKS = Math.round(2000 / MP_TICK_MS);
export const MP_CUT_PER_APPLE = 4;
export const MP_CUT_APPLE_CAP = 3;
export const MP_SHED_COOLDOWN = Math.round(2000 / MP_TICK_MS);
export const MP_SHIELD_TICKS = Math.round(1000 / MP_TICK_MS);
export const MP_SHIELD_COOLDOWN = MP_SHED_COOLDOWN;
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
  | "bomb"
  | "trap";

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

export interface MpTrap {
  ownerId: string;
  x: number;
  y: number;
}

export interface MpBlast {
  x: number;
  y: number;
  life: number;
}

export interface MpCorpse {
  ownerId: string;
  cells: Point[];
  life: number;
}

export interface MpHumiliation {
  victimId: string;
  attackerId: string;
  life: number;
}

export interface MpSnapshot {
  snakes: MpSnake[];
  foods: Point[];
  shots: MpShot[];
  bombs: MpBomb[];
  blasts: MpBlast[];
  corpses: MpCorpse[];
  traps: MpTrap[];
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
  queuedSheds: number;
  queuedShields: number;
  queuedTraps: number;
  turboLeft: number;
  headingHold: number;
  winHold: number;
  shedCooldown: number;
  shieldCooldown: number;
  shieldLeft: number;
  roundWins: number;
}

export interface MpState {
  snakes: MpSnake[];
  foods: Point[];
  shots: MpShot[];
  bombs: MpBomb[];
  blasts: MpBlast[];
  corpses: MpCorpse[];
  traps: MpTrap[];
  humiliations: MpHumiliation[];
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
  roundSeq: number;
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

export function mpFoodTarget(snakeCount: number): number {
  return Math.max(1, snakeCount);
}

function refillFoods(
  bodies: Point[],
  foods: Point[],
  target: number,
  rng: Rng,
): Point[] {
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
    corpses: state.corpses.map((corpse) => ({
      ...corpse,
      cells: corpse.cells.map((point) => ({ ...point })),
    })),
    traps: state.traps.map((trap) => ({ ...trap })),
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
  if (host.tick === local.tick && mine.queuedSheds > 0) {
    next = {
      ...next,
      snakes: next.snakes.map((snake) =>
        snake.id === playerId
          ? {
              ...snake,
              queuedSheds: Math.max(snake.queuedSheds, mine.queuedSheds),
            }
          : snake,
      ),
    };
  }
  if (host.tick === local.tick && mine.queuedShields > 0) {
    next = {
      ...next,
      snakes: next.snakes.map((snake) =>
        snake.id === playerId
          ? {
              ...snake,
              queuedShields: Math.max(snake.queuedShields, mine.queuedShields),
            }
          : snake,
      ),
    };
  }
  if (host.tick === local.tick && mine.queuedTraps > 0) {
    next = {
      ...next,
      snakes: next.snakes.map((snake) =>
        snake.id === playerId
          ? {
              ...snake,
              queuedTraps: Math.max(snake.queuedTraps, mine.queuedTraps),
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
  queuedSheds?: number;
  queuedShields?: number;
  queuedTraps?: number;
  turboLeft?: number;
  headingHold?: number;
  winHold?: number;
  shedCooldown?: number;
  shieldCooldown?: number;
  shieldLeft?: number;
  roundWins?: number;
}

interface MpWirePacked {
  o: string[];
  p: number[];
}

interface MpWireSnapshot {
  snakes: MpWireSnake[];
  foods: number[];
  shots?: MpShot[] | MpWirePacked;
  bombs?: MpBomb[] | MpWirePacked;
  blasts?: MpBlast[];
  corpses?: MpCorpse[];
  traps?: MpTrap[] | MpWirePacked;
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
  roundSeq?: number;
  snakes: MpWireSnake[];
  foods: number[];
  shots?: MpShot[] | MpWirePacked;
  bombs?: MpBomb[] | MpWirePacked;
  blasts?: MpBlast[];
  corpses?: MpCorpse[];
  traps?: MpTrap[] | MpWirePacked;
  humiliations?: MpHumiliation[];
  lastDeaths?: MpDeath[];
  replay?: MpWireSnapshot[];
}

const SHOT_DIR_CODE: Record<Direction, number> = {
  up: 0,
  right: 1,
  down: 2,
  left: 3,
};
const SHOT_DIR_FROM_CODE: Direction[] = ["up", "right", "down", "left"];

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

function packShots(shots: MpShot[]): MpWirePacked {
  const o: string[] = [];
  const p: number[] = [];
  for (const shot of shots) {
    o.push(shot.ownerId);
    p.push(shot.x, shot.y, SHOT_DIR_CODE[shot.direction]);
  }
  return { o, p };
}

function unpackShots(value: unknown): MpShot[] {
  if (value == null) {
    return [];
  }
  if (Array.isArray(value)) {
    const shots: MpShot[] = [];
    for (const item of value) {
      if (typeof item !== "object" || item === null) {
        continue;
      }
      const row = item as {
        ownerId?: unknown;
        x?: unknown;
        y?: unknown;
        direction?: unknown;
      };
      if (
        typeof row.ownerId !== "string" ||
        typeof row.x !== "number" ||
        typeof row.y !== "number" ||
        !isDirection(row.direction)
      ) {
        continue;
      }
      shots.push({
        ownerId: row.ownerId,
        x: row.x,
        y: row.y,
        direction: row.direction,
      });
    }
    return shots;
  }
  if (typeof value !== "object") {
    return [];
  }
  const row = value as { o?: unknown; p?: unknown };
  if (!Array.isArray(row.o) || !Array.isArray(row.p)) {
    return [];
  }
  const owners = row.o;
  const data = row.p;
  if (data.length !== owners.length * 3) {
    return [];
  }
  const shots: MpShot[] = [];
  for (let index = 0; index < owners.length; index += 1) {
    const ownerId: unknown = owners[index];
    const x: unknown = data[index * 3];
    const y: unknown = data[index * 3 + 1];
    const dirCode: unknown = data[index * 3 + 2];
    if (
      typeof ownerId !== "string" ||
      typeof x !== "number" ||
      typeof y !== "number"
    ) {
      continue;
    }
    if (dirCode !== 0 && dirCode !== 1 && dirCode !== 2 && dirCode !== 3) {
      continue;
    }
    shots.push({
      ownerId,
      x,
      y,
      direction: SHOT_DIR_FROM_CODE[dirCode],
    });
  }
  return shots;
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
  if (snake.queuedSheds > 0) {
    packed.queuedSheds = snake.queuedSheds;
  }
  if (snake.queuedShields > 0) {
    packed.queuedShields = snake.queuedShields;
  }
  if (snake.queuedTraps > 0) {
    packed.queuedTraps = snake.queuedTraps;
  }
  if (snake.turboLeft > 0) {
    packed.turboLeft = snake.turboLeft;
  }
  if (snake.headingHold > 0) {
    packed.headingHold = snake.headingHold;
  }
  if (snake.winHold > 0) {
    packed.winHold = snake.winHold;
  }
  if (snake.shedCooldown > 0) {
    packed.shedCooldown = snake.shedCooldown;
  }
  if (snake.shieldCooldown > 0) {
    packed.shieldCooldown = snake.shieldCooldown;
  }
  if (snake.shieldLeft > 0) {
    packed.shieldLeft = snake.shieldLeft;
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
    queuedSheds:
      typeof row.queuedSheds === "number"
        ? Math.max(0, Math.floor(row.queuedSheds))
        : 0,
    queuedShields:
      typeof row.queuedShields === "number"
        ? Math.max(0, Math.floor(row.queuedShields))
        : 0,
    queuedTraps:
      typeof row.queuedTraps === "number"
        ? Math.max(0, Math.floor(row.queuedTraps))
        : 0,
    turboLeft:
      typeof row.turboLeft === "number"
        ? Math.max(0, Math.floor(row.turboLeft))
        : 0,
    headingHold:
      typeof row.headingHold === "number"
        ? Math.max(0, Math.floor(row.headingHold))
        : 0,
    winHold:
      typeof row.winHold === "number"
        ? Math.max(0, Math.floor(row.winHold))
        : 0,
    shedCooldown:
      typeof row.shedCooldown === "number"
        ? Math.max(0, Math.floor(row.shedCooldown))
        : 0,
    shieldCooldown:
      typeof row.shieldCooldown === "number"
        ? Math.max(0, Math.floor(row.shieldCooldown))
        : 0,
    shieldLeft:
      typeof row.shieldLeft === "number"
        ? Math.max(0, Math.floor(row.shieldLeft))
        : 0,
    roundWins:
      typeof row.roundWins === "number"
        ? Math.max(0, Math.floor(row.roundWins))
        : 0,
  };
}

function packBombs(bombs: MpBomb[]): MpWirePacked {
  const o: string[] = [];
  const p: number[] = [];
  for (const bomb of bombs) {
    o.push(bomb.ownerId);
    p.push(bomb.x, bomb.y, bomb.fuse);
  }
  return { o, p };
}

function unpackBombs(value: unknown): MpBomb[] {
  if (value == null) {
    return [];
  }
  if (Array.isArray(value)) {
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
  if (typeof value !== "object") {
    return [];
  }
  const row = value as { o?: unknown; p?: unknown };
  if (!Array.isArray(row.o) || !Array.isArray(row.p)) {
    return [];
  }
  const owners = row.o;
  const data = row.p;
  if (data.length !== owners.length * 3) {
    return [];
  }
  const bombs: MpBomb[] = [];
  for (let index = 0; index < owners.length; index += 1) {
    const ownerId: unknown = owners[index];
    const x: unknown = data[index * 3];
    const y: unknown = data[index * 3 + 1];
    const fuse: unknown = data[index * 3 + 2];
    if (
      typeof ownerId !== "string" ||
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof fuse !== "number"
    ) {
      continue;
    }
    bombs.push({
      ownerId,
      x,
      y,
      fuse: Math.max(0, Math.floor(fuse)),
    });
  }
  return bombs;
}

function packTraps(traps: MpTrap[]): MpWirePacked {
  const o: string[] = [];
  const p: number[] = [];
  for (const trap of traps) {
    o.push(trap.ownerId);
    p.push(trap.x, trap.y);
  }
  return { o, p };
}

function unpackTraps(value: unknown): MpTrap[] {
  if (value == null) {
    return [];
  }
  if (Array.isArray(value)) {
    const traps: MpTrap[] = [];
    for (const item of value) {
      if (typeof item !== "object" || item === null) {
        continue;
      }
      const row = item as { ownerId?: unknown; x?: unknown; y?: unknown };
      if (
        typeof row.ownerId !== "string" ||
        typeof row.x !== "number" ||
        typeof row.y !== "number"
      ) {
        continue;
      }
      traps.push({ ownerId: row.ownerId, x: row.x, y: row.y });
    }
    return traps;
  }
  if (typeof value !== "object") {
    return [];
  }
  const row = value as { o?: unknown; p?: unknown };
  if (!Array.isArray(row.o) || !Array.isArray(row.p)) {
    return [];
  }
  const owners = row.o;
  const data = row.p;
  if (data.length !== owners.length * 2) {
    return [];
  }
  const traps: MpTrap[] = [];
  for (let index = 0; index < owners.length; index += 1) {
    const ownerId: unknown = owners[index];
    const x: unknown = data[index * 2];
    const y: unknown = data[index * 2 + 1];
    if (
      typeof ownerId !== "string" ||
      typeof x !== "number" ||
      typeof y !== "number"
    ) {
      continue;
    }
    traps.push({ ownerId, x, y });
  }
  return traps;
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

function unpackCorpses(value: unknown): MpCorpse[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const corpses: MpCorpse[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const row = item as { ownerId?: unknown; cells?: unknown; life?: unknown };
    const cells = unpackPoints(row.cells);
    if (
      typeof row.ownerId !== "string" ||
      !cells ||
      typeof row.life !== "number"
    ) {
      continue;
    }
    corpses.push({
      ownerId: row.ownerId,
      cells,
      life: Math.max(0, Math.floor(row.life)),
    });
  }
  return corpses;
}

function unpackHumiliations(value: unknown): MpHumiliation[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const humiliations: MpHumiliation[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const row = item as {
      victimId?: unknown;
      attackerId?: unknown;
      life?: unknown;
    };
    if (
      typeof row.victimId !== "string" ||
      typeof row.attackerId !== "string" ||
      typeof row.life !== "number"
    ) {
      continue;
    }
    humiliations.push({
      victimId: row.victimId,
      attackerId: row.attackerId,
      life: Math.max(0, Math.floor(row.life)),
    });
  }
  return humiliations;
}

function packSnapshot(snapshot: MpSnapshot): MpWireSnapshot {
  const packed: MpWireSnapshot = {
    snakes: snapshot.snakes.map(packSnake),
    foods: packPoints(snapshot.foods),
  };
  if (snapshot.shots.length > 0) {
    packed.shots = packShots(snapshot.shots);
  }
  if (snapshot.bombs.length > 0) {
    packed.bombs = packBombs(snapshot.bombs);
  }
  if (snapshot.blasts.length > 0) {
    packed.blasts = snapshot.blasts;
  }
  if (snapshot.corpses.length > 0) {
    packed.corpses = snapshot.corpses;
  }
  if (snapshot.traps.length > 0) {
    packed.traps = packTraps(snapshot.traps);
  }
  return packed;
}

function unpackSnapshot(value: unknown): MpSnapshot | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const foods = unpackPoints(row.foods);
  if (!Array.isArray(row.snakes) || !foods) {
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
    shots: unpackShots(row.shots),
    bombs: unpackBombs(row.bombs),
    blasts: unpackBlasts(row.blasts),
    corpses: unpackCorpses(row.corpses),
    traps: unpackTraps(row.traps),
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
        corpses: state.corpses,
        traps: state.traps,
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

export function acceptHostTick(
  lastTick: number,
  incoming: Pick<MpState, "tick" | "status" | "roundSeq"> & {
    replayIndex?: number;
    countdown?: number;
  },
  currentStatus: MpStatus | undefined,
  currentReplayIndex = 0,
  currentRoundSeq = 0,
  currentCountdown = 0,
): boolean {
  const incomingSeq = incoming.roundSeq;
  if (incomingSeq < currentRoundSeq) {
    return false;
  }
  if (incomingSeq > currentRoundSeq) {
    return incoming.status !== "replay";
  }
  if (incoming.status === "replay") {
    if (currentStatus === "replay") {
      if (incoming.tick !== lastTick) {
        return incoming.tick > lastTick;
      }
      return (incoming.replayIndex ?? 0) > currentReplayIndex;
    }
    return currentStatus === "playing" && incoming.tick >= lastTick;
  }
  if (incoming.tick > lastTick) {
    return true;
  }
  if (incoming.tick < lastTick) {
    return false;
  }
  if (
    incoming.status === "countdown" &&
    currentStatus === "countdown" &&
    (incoming.countdown ?? 0) !== currentCountdown
  ) {
    return true;
  }
  return incoming.status !== currentStatus;
}

export function applyHostSnapshot(
  incoming: MpState,
  local: MpState | null,
  playerId: string,
): MpState {
  return retainReplay(keepLocalIntent(incoming, local, playerId), local);
}

export function shouldPredictLocalTick(
  localTick: number,
  hostTick: number,
): boolean {
  return hostTick >= 0 && localTick <= hostTick;
}

export function advanceLocalSnake(state: MpState, playerId: string): MpState {
  if (state.status !== "playing") {
    return state;
  }
  const mine = state.snakes.find((snake) => snake.id === playerId);
  if (!mine?.alive || mine.body.length === 0) {
    return state;
  }
  const dir =
    OPPOSITE[mine.direction] === mine.pending ? mine.direction : mine.pending;
  const delta = DIRECTION_DELTA[dir];
  const nextHead = {
    x: mine.body[0].x + delta.x,
    y: mine.body[0].y + delta.y,
  };
  const head = mine.turboLeft > 0 ? wrapCell(nextHead) : nextHead;
  if (mine.turboLeft <= 0 && !inBounds(head)) {
    return state;
  }
  const body = [head, ...mine.body.slice(0, -1)];
  return {
    ...state,
    tick: state.tick + 1,
    snakes: state.snakes.map((snake) =>
      snake.id === playerId ? { ...snake, body, direction: dir } : snake,
    ),
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
  wire.roundSeq = state.roundSeq;
  if (state.shots.length > 0) {
    wire.shots = packShots(state.shots);
  }
  if (state.bombs.length > 0) {
    wire.bombs = packBombs(state.bombs);
  }
  if (state.blasts.length > 0) {
    wire.blasts = state.blasts;
  }
  if (state.corpses.length > 0) {
    wire.corpses = state.corpses;
  }
  if (state.traps.length > 0) {
    wire.traps = packTraps(state.traps);
  }
  if (state.humiliations.length > 0) {
    wire.humiliations = state.humiliations;
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
  const shots = unpackShots(row.shots);
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
    corpses: unpackCorpses(row.corpses),
    traps: unpackTraps(row.traps),
    humiliations: unpackHumiliations(row.humiliations),
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
    roundSeq: typeof row.roundSeq === "number" ? row.roundSeq : 0,
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
    corpses: first.corpses,
    traps: first.traps,
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
    corpses: frame.corpses,
    traps: frame.traps,
  };
}

export function describeHumiliation(
  row: MpHumiliation,
  snakes: MpSnake[],
): string {
  const nameOf = (id: string): string =>
    snakes.find((snake) => snake.id === id)?.name ?? "Player";
  return `${nameOf(row.attackerId)} cut ${nameOf(row.victimId)} down to the head`;
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
        lines.push(`${nameOf(death.otherId)} bombed ${nameOf(death.playerId)}`);
      } else {
        lines.push(`${nameOf(death.playerId)} blew up`);
      }
      continue;
    }
    if (death.cause === "trap") {
      lines.push(
        death.otherId
          ? `${nameOf(death.playerId)} hit ${nameOf(death.otherId)}'s mine`
          : `${nameOf(death.playerId)} hit a mine`,
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
      queuedTurbo: 0,
      queuedBombs: 0,
      queuedSheds: 0,
      queuedShields: 0,
      queuedTraps: 0,
      turboLeft: 0,
      headingHold: 0,
      winHold: 0,
      shedCooldown: 0,
      shieldCooldown: 0,
      shieldLeft: 0,
      roundWins: 0,
    };
  });

  return {
    snakes,
    foods: [],
    shots: [],
    bombs: [],
    blasts: [],
    corpses: [],
    traps: [],
    humiliations: [],
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
    roundSeq: 0,
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
      power: MP_START_POWER,
      queuedFires: 0,
      fireCooldown: 0,
      queuedTurbo: 0,
      queuedBombs: 0,
      queuedSheds: 0,
      queuedShields: 0,
      queuedTraps: 0,
      turboLeft: 0,
      headingHold: 0,
      winHold: 0,
      shedCooldown: 0,
      shieldCooldown: 0,
      shieldLeft: 0,
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
  const foods = refillFoods(
    allBodies(snakes),
    [],
    mpFoodTarget(snakes.length),
    rng,
  );
  return {
    ...state,
    snakes,
    foods,
    shots: [],
    bombs: [],
    blasts: [],
    corpses: [],
    traps: [],
    humiliations: [],
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
    roundSeq: state.roundSeq + 1,
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
  return (
    snake.queuedFires +
    snake.queuedTurbo +
    snake.queuedBombs +
    snake.queuedSheds +
    snake.queuedShields +
    snake.queuedTraps
  );
}

function deadQueues(): Pick<
  MpSnake,
  | "queuedFires"
  | "queuedTurbo"
  | "queuedBombs"
  | "queuedSheds"
  | "queuedShields"
  | "queuedTraps"
  | "turboLeft"
  | "fireCooldown"
  | "shieldLeft"
> {
  return {
    queuedFires: 0,
    queuedTurbo: 0,
    queuedBombs: 0,
    queuedSheds: 0,
    queuedShields: 0,
    queuedTraps: 0,
    turboLeft: 0,
    fireCooldown: 0,
    shieldLeft: 0,
  };
}

function mapAliveSnake(
  state: MpState,
  playerId: string,
  update: (snake: MpSnake) => MpSnake,
): MpState {
  const snakes = state.snakes.slice();
  let changed = false;
  for (let index = 0; index < snakes.length; index += 1) {
    const snake = snakes[index];
    if (snake.id !== playerId || !snake.alive) {
      continue;
    }
    const next = update(snake);
    if (next !== snake) {
      snakes[index] = next;
      changed = true;
    }
  }
  if (!changed) {
    return state;
  }
  return { ...state, snakes };
}

export function queueMpInput(
  state: MpState,
  playerId: string,
  next: Direction,
): MpState {
  if (state.status !== "playing" && state.status !== "countdown") {
    return state;
  }
  return mapAliveSnake(state, playerId, (snake) => {
    if (OPPOSITE[snake.direction] === next || snake.pending === next) {
      return snake;
    }
    return { ...snake, pending: next };
  });
}

export function queueMpFire(state: MpState, playerId: string): MpState {
  if (state.status !== "playing") {
    return state;
  }
  return mapAliveSnake(state, playerId, (snake) => {
    const affordable = Math.floor(snake.power / MP_POWER_COST);
    if (queuedSpendSlots(snake) >= affordable) {
      return snake;
    }
    return { ...snake, queuedFires: snake.queuedFires + 1 };
  });
}

export function queueMpTurbo(state: MpState, playerId: string): MpState {
  if (state.status !== "playing") {
    return state;
  }
  return mapAliveSnake(state, playerId, (snake) => {
    if (snake.turboLeft > 0 || snake.queuedTurbo > 0) {
      return snake;
    }
    const affordable = Math.floor(snake.power / MP_POWER_COST);
    if (queuedSpendSlots(snake) >= affordable) {
      return snake;
    }
    return { ...snake, queuedTurbo: 1 };
  });
}

export function queueMpBomb(state: MpState, playerId: string): MpState {
  if (state.status !== "playing") {
    return state;
  }
  return mapAliveSnake(state, playerId, (snake) => {
    const affordable = Math.floor(snake.power / MP_POWER_COST);
    if (queuedSpendSlots(snake) >= affordable) {
      return snake;
    }
    return { ...snake, queuedBombs: snake.queuedBombs + 1 };
  });
}

export function queueMpShed(state: MpState, playerId: string): MpState {
  if (state.status !== "playing") {
    return state;
  }
  return mapAliveSnake(state, playerId, (snake) => {
    if (
      snake.shedCooldown > 0 ||
      snake.queuedSheds > 0 ||
      snake.body.length < 2
    ) {
      return snake;
    }
    const affordable = Math.floor(snake.power / MP_POWER_COST);
    if (queuedSpendSlots(snake) >= affordable) {
      return snake;
    }
    return { ...snake, queuedSheds: snake.queuedSheds + 1 };
  });
}

export function queueMpShield(state: MpState, playerId: string): MpState {
  if (state.status !== "playing") {
    return state;
  }
  return mapAliveSnake(state, playerId, (snake) => {
    if (
      snake.shieldCooldown > 0 ||
      snake.shieldLeft > 0 ||
      snake.queuedShields > 0
    ) {
      return snake;
    }
    const affordable = Math.floor(snake.power / MP_POWER_COST);
    if (queuedSpendSlots(snake) >= affordable) {
      return snake;
    }
    return { ...snake, queuedShields: snake.queuedShields + 1 };
  });
}

export function queueMpTrap(state: MpState, playerId: string): MpState {
  if (state.status !== "playing") {
    return state;
  }
  return mapAliveSnake(state, playerId, (snake) => {
    if (snake.queuedTraps > 0) {
      return snake;
    }
    const affordable = Math.floor(snake.power / MP_POWER_COST);
    if (queuedSpendSlots(snake) >= affordable) {
      return snake;
    }
    return { ...snake, queuedTraps: snake.queuedTraps + 1 };
  });
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
  const matchTaken = snakes.some((snake) => snake.roundWins >= MP_WINS_NEEDED);
  if (state.hostLeft || state.matchRound >= MP_ROUNDS || matchTaken) {
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
    .filter((snake) => snake.winHold >= 2 && snake.body.length >= MP_WIN_LENGTH)
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

interface TickDrops {
  apples: Point[];
  corpses: MpCorpse[];
  humiliations: MpHumiliation[];
  walled: Set<string>;
}

function emptyDrops(): TickDrops {
  return { apples: [], corpses: [], humiliations: [], walled: new Set() };
}

function noteSegments(
  drops: TickDrops,
  ownerId: string,
  segments: Point[],
  asWall: boolean,
): void {
  const count = Math.min(
    MP_CUT_APPLE_CAP,
    Math.floor(segments.length / MP_CUT_PER_APPLE),
  );
  const appleCells = segments.slice(segments.length - count);
  for (const apple of appleCells) {
    drops.apples.push({ ...apple });
  }
  if (!asWall) {
    return;
  }
  drops.walled.add(ownerId);
  const wall = segments.slice(0, segments.length - count);
  if (wall.length === 0) {
    return;
  }
  drops.corpses.push({
    ownerId,
    cells: wall.map((point) => ({ ...point })),
    life: MP_CORPSE_TICKS,
  });
}

function shotCells(origin: Point, direction: Direction): Point[] {
  const delta = DIRECTION_DELTA[direction];
  const cells: Point[] = [];
  let cursor = origin;
  for (let step = 0; step < MP_SHOT_STEP; step += 1) {
    cursor = { x: cursor.x + delta.x, y: cursor.y + delta.y };
    cells.push(cursor);
  }
  return cells;
}

interface MovingShot {
  ownerId: string;
  direction: Direction;
  from: Point;
  cells: Point[];
}

function movingShot(
  from: Point,
  direction: Direction,
  ownerId: string,
): MovingShot {
  return {
    ownerId,
    direction,
    from,
    cells: shotCells(from, direction),
  };
}

function shotsShareCell(a: MovingShot, b: MovingShot): boolean {
  const cellsA = [a.from, ...a.cells];
  const cellsB = [b.from, ...b.cells];
  for (const left of cellsA) {
    if (!inBounds(left)) {
      continue;
    }
    for (const right of cellsB) {
      if (pointsEqual(left, right)) {
        return true;
      }
    }
  }
  return false;
}

function cancelCrossingShots(moving: MovingShot[]): MovingShot[] {
  const dead = new Set<number>();
  for (let i = 0; i < moving.length; i += 1) {
    for (let j = i + 1; j < moving.length; j += 1) {
      const shotA = moving[i];
      const shotB = moving[j];
      if (
        shotA.ownerId === shotB.ownerId &&
        shotA.direction === shotB.direction
      ) {
        continue;
      }
      if (shotsShareCell(shotA, shotB)) {
        dead.add(i);
        dead.add(j);
      }
    }
  }
  if (dead.size === 0) {
    return moving;
  }
  return moving.filter((_, index) => !dead.has(index));
}

function ensureDeathWall(
  drops: TickDrops,
  ownerId: string,
  segments: Point[],
): void {
  if (drops.walled.has(ownerId) || segments.length === 0) {
    return;
  }
  drops.walled.add(ownerId);
  drops.corpses.push({
    ownerId,
    cells: segments.map((point) => ({ ...point })),
    life: MP_CORPSE_TICKS,
  });
}

function corpseOwner(corpses: MpCorpse[], point: Point): string | null {
  for (const corpse of corpses) {
    if (corpse.cells.some((cell) => pointsEqual(cell, point))) {
      return corpse.ownerId;
    }
  }
  return null;
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

function nextHeadingHold(snake: MpSnake, dir: Direction): number {
  return dir !== snake.direction ? 0 : snake.headingHold + 1;
}

function decideHeadPair(
  a: MpSnake,
  b: MpSnake,
  dying: Set<string>,
  deaths: Map<string, MpDeath>,
  combatScore: Map<string, number>,
  drops: TickDrops,
  lengthOf: (snake: MpSnake) => number,
  bodyOf: (snake: MpSnake) => Point[],
  popShield: (id: string) => boolean,
): void {
  const kill = (loser: MpSnake, winner: MpSnake): void => {
    if (popShield(loser.id)) {
      return;
    }
    dying.add(loser.id);
    rememberDeath(deaths, loser.id, "head", winner.id);
    addCombat(combatScore, winner.id, lengthOf(loser));
    noteSegments(drops, loser.id, bodyOf(loser), true);
  };
  const lenA = lengthOf(a);
  const lenB = lengthOf(b);
  if (lenA === lenB) {
    const trade = (loser: MpSnake, winner: MpSnake): void => {
      if (popShield(loser.id)) {
        return;
      }
      dying.add(loser.id);
      rememberDeath(deaths, loser.id, "head", winner.id);
      noteSegments(drops, loser.id, bodyOf(loser), true);
    };
    trade(a, b);
    trade(b, a);
    return;
  }
  const winner = lenA > lenB ? a : b;
  const loser = lenA > lenB ? b : a;
  kill(loser, winner);
}

function applyHeadCollisions(
  movers: MpSnake[],
  nextHead: Map<string, Point>,
  dying: Set<string>,
  deaths: Map<string, MpDeath>,
  combatScore: Map<string, number>,
  drops: TickDrops,
  lengthOf: (snake: MpSnake) => number,
  bodyOf: (snake: MpSnake) => Point[],
  popShield: (id: string) => boolean,
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
        if (popShield(id)) {
          continue;
        }
        dying.add(id);
        rememberDeath(
          deaths,
          id,
          "head",
          ids.find((other) => other !== id) ?? null,
        );
        const snake = byId.get(id);
        if (snake) {
          noteSegments(drops, id, bodyOf(snake), true);
        }
      }
      continue;
    }
    const a = byId.get(ids[0]);
    const b = byId.get(ids[1]);
    if (!a || !b) {
      continue;
    }
    decideHeadPair(
      a,
      b,
      dying,
      deaths,
      combatScore,
      drops,
      lengthOf,
      bodyOf,
      popShield,
    );
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
        decideHeadPair(
          a,
          b,
          dying,
          deaths,
          combatScore,
          drops,
          lengthOf,
          bodyOf,
          popShield,
        );
      }
    }
  }
}

function enemyTrap(
  traps: MpTrap[],
  point: Point,
  snakeId: string,
): MpTrap | null {
  return (
    traps.find(
      (trap) =>
        trap.ownerId !== snakeId && trap.x === point.x && trap.y === point.y,
    ) ?? null
  );
}

function clearTrap(traps: MpTrap[], point: Point): boolean {
  const index = traps.findIndex(
    (trap) => trap.x === point.x && trap.y === point.y,
  );
  if (index < 0) {
    return false;
  }
  traps.splice(index, 1);
  return true;
}

function resolveShot(
  here: Point,
  ownerId: string,
  snakes: MpSnake[],
  bodies: Map<string, Point[]>,
  foods: Point[],
  dying: Set<string>,
  deaths: Map<string, MpDeath>,
  combatScore: Map<string, number>,
  drops: TickDrops,
  corpses: MpCorpse[],
  traps: MpTrap[],
  popShield: (id: string) => boolean,
): { keep: boolean; foods: Point[] } {
  if (!inBounds(here)) {
    return { keep: false, foods };
  }
  if (clearTrap(traps, here)) {
    return { keep: false, foods };
  }
  if (corpseOwner(corpses, here)) {
    return { keep: false, foods };
  }

  const foodIndex = foods.findIndex((food) => pointsEqual(food, here));
  if (foodIndex >= 0) {
    return {
      keep: false,
      foods: foods.filter((_, index) => index !== foodIndex),
    };
  }

  for (const snake of snakes) {
    if (!snake.alive || dying.has(snake.id)) {
      const corpse = bodies.get(snake.id) ?? snake.body;
      if (corpse.some((segment) => pointsEqual(segment, here))) {
        return { keep: false, foods };
      }
      continue;
    }
    const body = bodies.get(snake.id) ?? snake.body;
    const hitIndex = body.findIndex((segment) => pointsEqual(segment, here));
    if (hitIndex < 0) {
      continue;
    }
    if (hitIndex === 0 && snake.id === ownerId) {
      continue;
    }
    if (popShield(snake.id)) {
      return { keep: false, foods };
    }
    if (hitIndex === 0) {
      if (snake.id === ownerId) {
        continue;
      }
      dying.add(snake.id);
      rememberDeath(deaths, snake.id, "shot", ownerId);
      addCombat(combatScore, ownerId, body.length);
      noteSegments(drops, snake.id, body, true);
      return { keep: false, foods };
    }
    const leftover = body.slice(0, hitIndex);
    const removed = body.slice(hitIndex);
    if (leftover.length === 0) {
      dying.add(snake.id);
      rememberDeath(deaths, snake.id, "shot", ownerId);
      addCombat(combatScore, ownerId, body.length);
      noteSegments(drops, snake.id, body, true);
    } else {
      bodies.set(snake.id, leftover);
      addCombat(combatScore, ownerId, removed.length);
      noteSegments(drops, snake.id, removed, false);
      if (leftover.length === 1 && ownerId !== snake.id) {
        drops.humiliations.push({
          victimId: snake.id,
          attackerId: ownerId,
          life: MP_HUMILIATION_TICKS,
        });
      }
    }
    return { keep: false, foods };
  }

  return { keep: true, foods };
}

function extraTurboStep(
  snakes: MpSnake[],
  foods: Point[],
  shots: MpShot[],
  corpses: MpCorpse[],
  drops: TickDrops,
  traps: MpTrap[],
  popShield: (id: string) => boolean,
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
    dying,
    deaths,
    combatScore,
    drops,
    (snake) => snake.body.length,
    (snake) => snake.body,
    popShield,
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
  for (const corpse of corpses) {
    for (const point of corpse.cells) {
      markOcc(point);
    }
  }
  for (const corpse of drops.corpses) {
    for (const point of corpse.cells) {
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
    const mine = enemyTrap(traps, head, snake.id);
    if (mine) {
      dying.add(snake.id);
      rememberDeath(deaths, snake.id, "trap", mine.ownerId);
      continue;
    }
    if (hasOcc(head)) {
      dying.add(snake.id);
      const owner = bodyOwner(snakes, head);
      const blockedBy =
        owner?.id ?? corpseOwner([...corpses, ...drops.corpses], head);
      if (!blockedBy || blockedBy === snake.id) {
        rememberDeath(deaths, snake.id, "self");
      } else {
        rememberDeath(deaths, snake.id, "body", blockedBy);
        addCombat(combatScore, blockedBy, snake.body.length);
      }
    }
  }
  for (const id of dying) {
    const snake = snakes.find((row) => row.id === id);
    if (snake) {
      ensureDeathWall(drops, id, snake.body);
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
        if (popShield(snake.id)) {
          liveShots.splice(i, 1);
          break;
        }
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
  popShield: (id: string) => boolean,
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
      if (
        snake.body.some(
          (segment) => chebyshev(segment, bomb) <= MP_BLAST_RADIUS,
        )
      ) {
        if (popShield(snake.id)) {
          continue;
        }
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
      dying.has(snake.id) ? { ...snake, alive: false, ...deadQueues() } : snake,
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
  const shedIds = new Set<string>();
  const shieldIds = new Set<string>();
  const trapIds = new Set<string>();
  const combatScore = new Map<string, number>();
  const drops = emptyDrops();
  const bombs = state.bombs.map((bomb) => ({ ...bomb }));
  const traps = state.traps.map((trap) => ({ ...trap }));
  const shieldBroken = new Set<string>();
  let shieldSnakes = state.snakes;
  const popShield = (id: string): boolean => {
    if (shieldBroken.has(id)) {
      return false;
    }
    const snake = shieldSnakes.find((row) => row.id === id);
    const up = Boolean(snake && (snake.shieldLeft > 0 || shieldIds.has(id)));
    if (!up) {
      return false;
    }
    shieldBroken.add(id);
    return true;
  };

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
  const spawned: MovingShot[] = [];
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
      spawned.push(movingShot(head, dir, snake.id));
      firedIds.add(snake.id);
    }
    if (
      snake.queuedSheds > 0 &&
      snake.shedCooldown <= 0 &&
      charges > 0 &&
      snake.body.length >= 2
    ) {
      const keep = Math.ceil(snake.body.length / 2);
      bodies.set(snake.id, snake.body.slice(0, keep));
      drops.corpses.push({
        ownerId: snake.id,
        cells: snake.body.slice(keep).map((point) => ({ ...point })),
        life: MP_CORPSE_TICKS,
      });
      shedIds.add(snake.id);
      charges -= 1;
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
    if (
      snake.queuedShields > 0 &&
      snake.shieldCooldown <= 0 &&
      snake.shieldLeft <= 0 &&
      charges > 0
    ) {
      shieldIds.add(snake.id);
      charges -= 1;
    }
    if (snake.queuedTraps > 0 && charges > 0 && snake.body.length > 0) {
      const tail = snake.body[snake.body.length - 1];
      const existing = traps.findIndex((trap) => trap.ownerId === snake.id);
      if (existing >= 0) {
        traps.splice(existing, 1);
      }
      traps.push({ ownerId: snake.id, x: tail.x, y: tail.y });
      trapIds.add(snake.id);
      charges -= 1;
    }
  }

  const traveling = state.shots.map((shot) =>
    movingShot(shot, shot.direction, shot.ownerId),
  );

  let foods = [...state.foods];
  const liveShots: MpShot[] = [];
  const shotCorpses = [...state.corpses, ...drops.corpses];
  for (const shot of cancelCrossingShots([...traveling, ...spawned])) {
    let keep = true;
    let end: Point | null = null;
    for (const cell of shot.cells) {
      const resolved = resolveShot(
        cell,
        shot.ownerId,
        state.snakes,
        bodies,
        foods,
        dying,
        deaths,
        combatScore,
        drops,
        shotCorpses,
        traps,
        popShield,
      );
      foods = resolved.foods;
      if (!resolved.keep) {
        keep = false;
        break;
      }
      end = cell;
    }
    if (keep && end) {
      liveShots.push({
        ownerId: shot.ownerId,
        x: end.x,
        y: end.y,
        direction: shot.direction,
      });
    }
  }

  for (const id of dying) {
    nextHead.delete(id);
  }

  applyHeadCollisions(
    alive,
    nextHead,
    dying,
    deaths,
    combatScore,
    drops,
    (snake) => remainingLength(snake, bodies),
    (snake) => bodies.get(snake.id) ?? snake.body,
    popShield,
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
  const liveHeads = new Set<number>();
  for (const [id, head] of nextHead) {
    if (!dying.has(id)) {
      liveHeads.add(cellCode(head));
    }
  }
  drops.corpses = drops.corpses
    .map((corpse) => ({
      ...corpse,
      cells: corpse.cells.filter((point) => !liveHeads.has(cellCode(point))),
    }))
    .filter((corpse) => corpse.cells.length > 0);
  for (const corpse of [...state.corpses, ...drops.corpses]) {
    for (const point of corpse.cells) {
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
    const mine = enemyTrap(traps, head, snake.id);
    if (mine) {
      dying.add(snake.id);
      rememberDeath(deaths, snake.id, "trap", mine.ownerId);
      continue;
    }
    if (hasOcc(head)) {
      dying.add(snake.id);
      const owner = bodyOwner(state.snakes, head);
      const blockedBy =
        owner?.id ?? corpseOwner([...state.corpses, ...drops.corpses], head);
      if (!blockedBy || blockedBy === snake.id) {
        rememberDeath(deaths, snake.id, "self");
      } else {
        rememberDeath(deaths, snake.id, "body", blockedBy);
        addCombat(combatScore, blockedBy, remainingLength(snake, bodies));
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
        if (popShield(snake.id)) {
          liveShots.splice(i, 1);
          break;
        }
        dying.add(snake.id);
        rememberDeath(deaths, snake.id, "shot", shot.ownerId);
        const body = bodies.get(snake.id) ?? snake.body;
        addCombat(combatScore, shot.ownerId, body.length);
        noteSegments(drops, snake.id, body, true);
        liveShots.splice(i, 1);
        break;
      }
    }
  }

  for (const id of dying) {
    eating.delete(id);
  }

  for (const id of dying) {
    const snake = state.snakes.find((row) => row.id === id);
    if (snake) {
      ensureDeathWall(drops, id, bodies.get(id) ?? snake.body);
    }
  }

  const snakes = state.snakes.map((snake) => {
    const apples = eating.has(snake.id) ? 1 : 0;
    const fired = firedIds.has(snake.id);
    const boosted = turboStarted.has(snake.id) && !dying.has(snake.id);
    const planted = plantedIds.has(snake.id);
    const shed = shedIds.has(snake.id) && !dying.has(snake.id);
    const shielded = shieldIds.has(snake.id) && !dying.has(snake.id);
    const trapped = trapIds.has(snake.id);
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
    if (shed) {
      spend += MP_POWER_COST;
    }
    if (shielded) {
      spend += MP_POWER_COST;
    }
    if (trapped) {
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
    const queuedSheds = shed ? 0 : snake.queuedSheds;
    const shedCooldown = shed
      ? MP_SHED_COOLDOWN
      : Math.max(0, snake.shedCooldown - 1);
    const queuedShields = shielded ? 0 : snake.queuedShields;
    const shieldCooldown = shielded
      ? MP_SHIELD_COOLDOWN
      : Math.max(0, snake.shieldCooldown - 1);
    const queuedTraps = trapped
      ? Math.max(0, snake.queuedTraps - 1)
      : snake.queuedTraps;
    const shieldLeft = shieldBroken.has(snake.id)
      ? 0
      : shielded
        ? MP_SHIELD_TICKS
        : Math.max(0, snake.shieldLeft - 1);
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
      queuedSheds,
      shedCooldown,
      queuedShields,
      queuedTraps,
      shieldCooldown,
      shieldLeft,
      turboLeft,
      score: Math.max(
        0,
        snake.score - lost * SCORE_PER_FOOD + apples * SCORE_PER_FOOD + combat,
      ),
      power: chargePower(powerBase, apples),
    };
  });

  shieldSnakes = snakes;

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

  const boosted = extraTurboStep(
    snakes,
    remainingFoods,
    liveShots,
    [...state.corpses, ...drops.corpses],
    drops,
    traps,
    popShield,
  );
  const cooled = boosted.snakes.map((snake) => ({
    ...snake,
    turboLeft: snake.alive && snake.turboLeft > 0 ? snake.turboLeft - 1 : 0,
  }));
  const deathMap = new Map<string, MpDeath>();
  for (const death of [...deaths.values(), ...boosted.deaths]) {
    deathMap.set(death.playerId, death);
  }
  const afterBombs = tickBombs(bombs, cooled, deathMap, popShield);
  const unshielded = afterBombs.snakes.map((snake) =>
    shieldBroken.has(snake.id) ? { ...snake, shieldLeft: 0 } : snake,
  );
  for (const snake of unshielded) {
    if (deathMap.has(snake.id)) {
      ensureDeathWall(drops, snake.id, snake.body);
    }
  }
  const agedBlasts = state.blasts
    .map((blast) => ({ ...blast, life: blast.life - 1 }))
    .filter((blast) => blast.life > 0);
  const lastDeaths =
    deathMap.size > 0 ? [...deathMap.values()] : state.lastDeaths;
  const corpses = [
    ...drops.corpses.filter((corpse) => corpse.cells.length > 0),
    ...state.corpses
      .map((corpse) => ({ ...corpse, life: corpse.life - 1 }))
      .filter((corpse) => corpse.life > 0),
  ];
  const expiredOwners = new Set(
    state.corpses
      .filter((corpse) => corpse.life <= 1)
      .map((corpse) => corpse.ownerId),
  );
  const heldSnakes = unshielded.map((snake) => {
    const diedNow = deathMap.has(snake.id);
    const faded = !snake.alive && expiredOwners.has(snake.id) && !diedNow;
    const body = diedNow || faded ? [] : snake.body;
    return {
      ...snake,
      body,
      winHold:
        snake.alive && body.length >= MP_WIN_LENGTH ? snake.winHold + 1 : 0,
    };
  });
  const blockedFood = new Set<number>();
  for (const snake of heldSnakes) {
    if (!snake.alive) {
      continue;
    }
    for (const point of snake.body) {
      blockedFood.add(cellCode(point));
    }
  }
  for (const corpse of corpses) {
    for (const point of corpse.cells) {
      blockedFood.add(cellCode(point));
    }
  }
  const withDrops = mergeApples(boosted.foods, drops.apples, blockedFood);
  const nextFoods =
    withDrops.length >= mpFoodTarget(state.snakes.length)
      ? withDrops
      : refillFoods(
          allBodies(heldSnakes),
          withDrops,
          mpFoodTarget(state.snakes.length),
          rng,
        );
  const freshVictims = new Set(drops.humiliations.map((row) => row.victimId));
  const humiliations = [
    ...drops.humiliations,
    ...state.humiliations
      .filter((row) => !freshVictims.has(row.victimId))
      .map((row) => ({ ...row, life: row.life - 1 }))
      .filter((row) => row.life > 0),
  ];

  return resolveWinner({
    ...state,
    snakes: heldSnakes,
    foods: nextFoods,
    shots: boosted.shots,
    bombs: afterBombs.bombs,
    blasts: [...agedBlasts, ...afterBombs.blasts],
    corpses,
    traps,
    humiliations,
    rngState: rng.state(),
    tick: state.tick + 1,
    lastDeaths,
  });
}

function mergeApples(
  foods: Point[],
  apples: Point[],
  blocked: Set<number>,
): Point[] {
  const next = foods.slice();
  const seen = occupancySet(next);
  for (const apple of apples) {
    const code = cellCode(apple);
    if (!inBounds(apple) || seen.has(code) || blocked.has(code)) {
      continue;
    }
    next.push(apple);
    seen.add(code);
  }
  return next;
}
