import {
  MP_GRID_HEIGHT,
  MP_GRID_WIDTH,
  MP_POWER_COST,
  MP_REPLAY_TICK_MS,
  MP_TICK_MS,
  type MpPlayer,
  type MpSnake,
  type MpState,
} from "./multiplayerEngine";
import { nextFreeColor } from "./snakeColors";
import type { Direction, Point } from "./types";
import { DIRECTION_DELTA, OPPOSITE } from "./types";

export const AI_YOU_ID = "you";
export const AI_FAST_TICK_MS = 20;

export function aiTickMs(state: MpState, youDead: boolean): number {
  if (state.status === "replay") {
    return MP_REPLAY_TICK_MS;
  }
  if (state.status === "playing" && youDead) {
    return AI_FAST_TICK_MS;
  }
  return MP_TICK_MS;
}

export const AI_BOTS = [
  { id: "hex", name: "HEX" },
  { id: "rom", name: "ROM" },
  { id: "lcd", name: "LCD" },
] as const;

export type AiKind = "farmer" | "hunter" | "flanker";

export interface AiAction {
  dir: Direction;
  fire: boolean;
}

const TURN: Direction[] = ["up", "right", "down", "left"];
const INF = 10_000;

function cellKey(point: Point): string {
  return `${point.x},${point.y}`;
}

function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function ahead(point: Point, direction: Direction): Point {
  const delta = DIRECTION_DELTA[direction];
  return { x: point.x + delta.x, y: point.y + delta.y };
}

function inBounds(point: Point): boolean {
  return (
    point.x >= 0 &&
    point.x < MP_GRID_WIDTH &&
    point.y >= 0 &&
    point.y < MP_GRID_HEIGHT
  );
}

function rotate(direction: Direction, turn: 1 | -1): Direction {
  const index = TURN.indexOf(direction);
  return TURN[(index + turn + TURN.length) % TURN.length];
}

function candidates(direction: Direction): Direction[] {
  return [direction, rotate(direction, -1), rotate(direction, 1)];
}

export function aiKind(playerId: string): AiKind | null {
  if (playerId === "hex") {
    return "farmer";
  }
  if (playerId === "rom") {
    return "hunter";
  }
  if (playerId === "lcd") {
    return "flanker";
  }
  return null;
}

export function isAiId(playerId: string): boolean {
  return aiKind(playerId) !== null;
}

export function createAiPlayers(you: {
  name: string;
  color: string;
}): MpPlayer[] {
  const taken = new Set<string>([you.color]);
  const bots: MpPlayer[] = AI_BOTS.map((bot, index) => {
    const color = nextFreeColor(taken);
    taken.add(color);
    return {
      id: bot.id,
      name: bot.name,
      color,
      host: false,
      ready: true,
      joinedAt: index + 2,
    };
  });
  return [
    {
      id: AI_YOU_ID,
      name: you.name,
      color: you.color,
      host: true,
      ready: true,
      joinedAt: 1,
    },
    ...bots,
  ];
}

function occupancy(state: MpState, self: MpSnake, next: Point): Set<string> {
  const eating = state.foods.some((food) => pointsEqual(food, next));
  const blocked = new Set<string>();
  for (const snake of state.snakes) {
    const skipTail = snake.id === self.id && !eating && snake.body.length > 0;
    const body = skipTail ? snake.body.slice(0, -1) : snake.body;
    for (const point of body) {
      blocked.add(cellKey(point));
    }
  }
  return blocked;
}

function bfsDist(
  start: Point,
  goals: Point[],
  blocked: Set<string>,
  cap = 80,
): number {
  if (goals.length === 0) {
    return INF;
  }
  const want = new Set(goals.map(cellKey));
  if (want.has(cellKey(start))) {
    return 0;
  }
  const seen = new Set<string>([cellKey(start)]);
  const queue: { point: Point; dist: number }[] = [{ point: start, dist: 0 }];
  let cursor = 0;
  while (cursor < queue.length) {
    const node = queue[cursor];
    cursor += 1;
    if (node.dist >= cap) {
      return INF;
    }
    for (const dir of TURN) {
      const step = ahead(node.point, dir);
      const key = cellKey(step);
      if (!inBounds(step) || blocked.has(key) || seen.has(key)) {
        continue;
      }
      if (want.has(key)) {
        return node.dist + 1;
      }
      seen.add(key);
      queue.push({ point: step, dist: node.dist + 1 });
    }
  }
  return INF;
}

function flood(start: Point, blocked: Set<string>, cap = 48): number {
  const seen = new Set<string>([cellKey(start)]);
  const queue: Point[] = [start];
  let cursor = 0;
  while (cursor < queue.length && seen.size < cap) {
    const point = queue[cursor];
    cursor += 1;
    for (const dir of TURN) {
      const step = ahead(point, dir);
      const key = cellKey(step);
      if (!inBounds(step) || blocked.has(key) || seen.has(key)) {
        continue;
      }
      seen.add(key);
      queue.push(step);
    }
  }
  return seen.size;
}

type RayHit = "head" | "food" | "body" | "wall";

function rayHit(
  start: Point,
  direction: Direction,
  state: MpState,
  ownerId: string,
): RayHit {
  let cursor = start;
  for (let i = 0; i < MP_GRID_WIDTH + MP_GRID_HEIGHT; i += 1) {
    if (!inBounds(cursor)) {
      return "wall";
    }
    if (state.foods.some((food) => pointsEqual(food, cursor))) {
      return "food";
    }
    for (const snake of state.snakes) {
      if (!snake.body[0]) {
        continue;
      }
      if (
        snake.id !== ownerId &&
        snake.alive &&
        pointsEqual(snake.body[0], cursor)
      ) {
        return "head";
      }
      const bodyHit = snake.body.some((segment, index) => {
        if (index === 0 && snake.id !== ownerId && snake.alive) {
          return false;
        }
        return pointsEqual(segment, cursor);
      });
      if (bodyHit) {
        return "body";
      }
    }
    cursor = ahead(cursor, direction);
  }
  return "wall";
}

function shotSpawn(head: Point, direction: Direction): Point {
  return ahead(ahead(head, direction), direction);
}

function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function foodGoals(
  state: MpState,
  self: MpSnake,
  kind: AiKind,
  blocked: Set<string>,
): Point[] {
  if (state.foods.length === 0) {
    return [];
  }
  const others = state.snakes.filter(
    (snake) => snake.alive && snake.id !== self.id,
  );
  const ranked = state.foods.map((food) => {
    const mine = bfsDist(self.body[0], [food], blocked);
    let rival = INF;
    for (const other of others) {
      rival = Math.min(rival, manhattan(other.body[0], food));
    }
    return { food, mine, rival };
  });
  const reachable = ranked.filter((row) => row.mine < INF);
  const pool = reachable.length > 0 ? reachable : ranked;
  const winnable = pool.filter((row) => row.mine <= row.rival + 1);
  if (kind === "flanker") {
    const open = pool.filter((row) => row.mine <= row.rival);
    if (open.length > 0) {
      return open.map((row) => row.food);
    }
  }
  return (winnable.length > 0 ? winnable : pool).map((row) => row.food);
}

function edgeMargin(point: Point): number {
  return Math.min(
    point.x,
    point.y,
    MP_GRID_WIDTH - 1 - point.x,
    MP_GRID_HEIGHT - 1 - point.y,
  );
}

function edgeCost(point: Point): number {
  const margin = edgeMargin(point);
  if (margin <= 0) {
    return 280;
  }
  if (margin === 1) {
    return 90;
  }
  if (margin === 2) {
    return 25;
  }
  return 0;
}

function projectedHeads(
  state: MpState,
  selfId: string,
): {
  contested: Set<string>;
  cuts: Set<string>;
} {
  const contested = new Set<string>();
  const cuts = new Set<string>();
  for (const snake of state.snakes) {
    if (!snake.alive || snake.id === selfId || !snake.body[0]) {
      continue;
    }
    const dir =
      OPPOSITE[snake.direction] === snake.pending
        ? snake.direction
        : snake.pending;
    const next = ahead(snake.body[0], dir);
    contested.add(cellKey(next));
    cuts.add(cellKey(ahead(next, dir)));
  }
  return { contested, cuts };
}

export function chooseAiAction(state: MpState, playerId: string): AiAction {
  const kind = aiKind(playerId) ?? "farmer";
  const self = state.snakes.find((snake) => snake.id === playerId);
  if (!self?.alive || state.status !== "playing" || !self.body[0]) {
    return { dir: self?.direction ?? "right", fire: false };
  }

  const head = self.body[0];
  const { contested, cuts } = projectedHeads(state, self.id);
  const lookBlocked = occupancy(state, self, { x: -1, y: -1 });
  const goals = foodGoals(state, self, kind, lookBlocked);
  let bestDir = self.direction;
  let bestScore = -INF;

  for (const dir of candidates(self.direction)) {
    if (OPPOSITE[self.direction] === dir) {
      continue;
    }
    const next = ahead(head, dir);
    if (!inBounds(next)) {
      continue;
    }
    const blocked = occupancy(state, self, next);
    if (blocked.has(cellKey(next))) {
      continue;
    }
    const space = flood(next, blocked);
    const foodDist = goals.length > 0 ? bfsDist(next, goals, blocked) : INF;
    const spawn = shotSpawn(head, dir);
    const hit = rayHit(spawn, dir, state, self.id);
    let score = space;
    const closeFood = foodDist <= 8;
    if (foodDist < INF) {
      score += 12_000 - foodDist * 80;
    }
    if (dir === self.direction) {
      score += 18;
    }
    if (!closeFood) {
      score -= edgeCost(next);
    }
    const nextKey = cellKey(next);
    if (contested.has(nextKey)) {
      score -= 4_000;
    }
    if (
      kind !== "farmer" &&
      cuts.has(nextKey) &&
      self.power >= MP_POWER_COST &&
      !closeFood
    ) {
      score += 900;
    }
    if (hit === "head" && self.power >= MP_POWER_COST) {
      score += kind === "hunter" ? 20_000 : 6_000;
    }
    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }

  const fireHit = rayHit(shotSpawn(head, bestDir), bestDir, state, self.id);
  const fire =
    self.power >= MP_POWER_COST && (fireHit === "head" || fireHit === "food");

  return { dir: bestDir, fire };
}
