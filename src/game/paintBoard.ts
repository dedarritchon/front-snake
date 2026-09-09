import { snakeSegmentColor } from "./snakeColors";
import type { Point } from "./types";

export const LCD = {
  bg: "#b7c86a",
  pixel: "#2a3816",
  pixelSoft: "rgba(42, 56, 22, 0.14)",
  border: "#243214",
};

export interface CanvasPaintCache {
  ctx: CanvasRenderingContext2D | null;
  cssW: number;
  cssH: number;
  dpr: number;
  pixelW: number;
  pixelH: number;
}

export interface PaintSnake {
  id?: string;
  color: string;
  body: Point[];
  alive?: boolean;
  turboLeft?: number;
  style?: "normal" | "logo" | "ambient";
}

export interface PaintShot {
  ownerId: string;
  x: number;
  y: number;
}

export interface PaintBomb {
  ownerId: string;
  x: number;
  y: number;
  fuse: number;
}

export interface PaintBlast {
  x: number;
  y: number;
  life: number;
}

export interface PaintGridExtras {
  tick?: number;
  bombs?: PaintBomb[];
  blasts?: PaintBlast[];
  now?: number;
  lastTickAt?: number;
  tickMs?: number;
  fuseTicks?: number;
  blastTicks?: number;
}

export function createCanvasPaintCache(): CanvasPaintCache {
  return { ctx: null, cssW: 0, cssH: 0, dpr: 0, pixelW: 0, pixelH: 0 };
}

export function setCanvasCssSize(
  cache: CanvasPaintCache,
  width: number,
  height: number,
): void {
  cache.cssW = width;
  cache.cssH = height;
}

export function bindCanvas(
  cache: CanvasPaintCache,
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D | null {
  if (cache.ctx?.canvas !== canvas) {
    cache.ctx = canvas.getContext("2d");
  }
  return cache.ctx;
}

export function lerpAmount(
  lastTickAt: number,
  tickMs: number,
  now: number,
  skip: boolean,
): number {
  if (skip || tickMs <= 0) {
    return 1;
  }
  const t = (now - lastTickAt) / tickMs;
  if (t <= 0) {
    return 0;
  }
  if (t >= 1) {
    return 1;
  }
  return t;
}

function wrapDelta(from: number, to: number, size: number): number {
  if (size <= 0) {
    return to - from;
  }
  let delta = to - from;
  const half = size / 2;
  if (delta > half) {
    delta -= size;
  } else if (delta < -half) {
    delta += size;
  }
  return delta;
}

function wrapCoord(value: number, size: number): number {
  if (size <= 0) {
    return value;
  }
  return ((value % size) + size) % size;
}

function lerpAxis(
  from: Point,
  to: Point,
  t: number,
  cols: number,
  rows: number,
): Point {
  const dx = wrapDelta(from.x, to.x, cols);
  const dy = wrapDelta(from.y, to.y, rows);
  if (dx !== 0 && dy !== 0) {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const dist = t * (ax + ay);
    if (dist <= ax) {
      return {
        x: wrapCoord(from.x + Math.sign(dx) * dist, cols),
        y: wrapCoord(from.y, rows),
      };
    }
    return {
      x: wrapCoord(from.x + dx, cols),
      y: wrapCoord(from.y + Math.sign(dy) * (dist - ax), rows),
    };
  }
  return {
    x: wrapCoord(from.x + dx * t, cols),
    y: wrapCoord(from.y + dy * t, rows),
  };
}

export function lerpBodies(
  prev: Point[] | undefined,
  curr: Point[],
  t: number,
  cols = 0,
  rows = 0,
): Point[] {
  if (!prev || t >= 1) {
    return curr;
  }
  if (t <= 0) {
    return prev;
  }
  if (curr.length === 0) {
    return curr;
  }
  const shared = Math.min(prev.length, curr.length);
  const out: Point[] = [];
  for (let i = 0; i < shared; i += 1) {
    out.push(lerpAxis(prev[i], curr[i], t, cols, rows));
  }
  for (let i = shared; i < curr.length; i += 1) {
    out.push(curr[i]);
  }
  return out;
}

function syncCanvasSize(
  canvas: HTMLCanvasElement,
  cache: CanvasPaintCache,
): CanvasRenderingContext2D | null {
  const ctx = bindCanvas(cache, canvas);
  if (!ctx) {
    return null;
  }
  const dpr = window.devicePixelRatio || 1;
  const width = cache.cssW;
  const height = cache.cssH;
  if (width <= 0 || height <= 0) {
    return null;
  }
  const pixelW = Math.round(width * dpr);
  const pixelH = Math.round(height * dpr);
  if (
    cache.dpr !== dpr ||
    cache.pixelW !== pixelW ||
    cache.pixelH !== pixelH ||
    canvas.width !== pixelW ||
    canvas.height !== pixelH
  ) {
    canvas.width = pixelW;
    canvas.height = pixelH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cache.dpr = dpr;
    cache.pixelW = pixelW;
    cache.pixelH = pixelH;
  }
  return ctx;
}

function paintFood(
  ctx: CanvasRenderingContext2D,
  food: Point,
  cellW: number,
  cellH: number,
): void {
  const left = food.x * cellW;
  const top = food.y * cellH;
  ctx.fillStyle = LCD.pixel;
  ctx.fillRect(
    left + cellW * 0.38,
    top + cellH * 0.08,
    cellW * 0.24,
    cellH * 0.84,
  );
  ctx.fillRect(
    left + cellW * 0.08,
    top + cellH * 0.38,
    cellW * 0.84,
    cellH * 0.24,
  );
  ctx.fillStyle = LCD.bg;
  ctx.fillRect(
    left + cellW * 0.34,
    top + cellH * 0.34,
    cellW * 0.32,
    cellH * 0.32,
  );
}

type Side = "n" | "s" | "e" | "w";

function neighborSide(
  from: Point,
  to: Point,
  cols: number,
  rows: number,
): Side | null {
  const dx = wrapDelta(from.x, to.x, cols);
  const dy = wrapDelta(from.y, to.y, rows);
  if (dx === 0 && dy === 0) {
    return null;
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? "e" : "w";
  }
  return dy > 0 ? "s" : "n";
}

function innerCorner(a: Side, b: Side): 0 | 1 | 2 | 3 | null {
  const key = a + b;
  if (key === "nw" || key === "wn") {
    return 0;
  }
  if (key === "ne" || key === "en") {
    return 1;
  }
  if (key === "se" || key === "es") {
    return 2;
  }
  if (key === "sw" || key === "ws") {
    return 3;
  }
  return null;
}

function elbowCorner(
  towardHead: Point | undefined,
  curr: Point,
  towardTail: Point | undefined,
  cols = 0,
  rows = 0,
): 0 | 1 | 2 | 3 | null {
  if (!towardHead || !towardTail) {
    return null;
  }
  const a = neighborSide(curr, towardHead, cols, rows);
  const b = neighborSide(curr, towardTail, cols, rows);
  if (!a || !b) {
    return null;
  }
  return innerCorner(a, b);
}

export function elbowRadii(
  towardHead: Point | undefined,
  curr: Point,
  towardTail: Point | undefined,
  radius: number,
  cols = 0,
  rows = 0,
): [number, number, number, number] | null {
  if (radius <= 0) {
    return null;
  }
  const inner = elbowCorner(towardHead, curr, towardTail, cols, rows);
  if (inner === null) {
    return null;
  }
  const radii: [number, number, number, number] = [0, 0, 0, 0];
  radii[(inner + 2) % 4] = radius;
  return radii;
}

function fillSegment(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: [number, number, number, number] | null,
): void {
  if (!radii) {
    ctx.fillRect(x, y, w, h);
    return;
  }
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radii);
  ctx.fill();
}

export function bombBlinkOn(
  fuse: number,
  fuseTicks: number,
  tickMs: number,
  lastTickAt: number,
  now: number,
): boolean {
  const elapsed = Math.max(0, (fuseTicks - fuse) * tickMs + (now - lastTickAt));
  const sec = Math.min(2, Math.floor(elapsed / 1000));
  const period = sec === 0 ? 400 : sec === 1 ? 200 : 100;
  return Math.floor(elapsed / period) % 2 === 0;
}

function paintOneSnake(
  ctx: CanvasRenderingContext2D,
  snake: PaintSnake,
  body: Point[],
  cellW: number,
  cellH: number,
  tick: number,
  cols: number,
  rows: number,
): void {
  const style = snake.style ?? "normal";
  const alive = snake.alive !== false;
  let inset = 0.08;
  let alpha = 1;
  if (style === "logo") {
    inset = 0.11;
    alpha = 0.92;
  } else if (style === "ambient") {
    inset = 0.08;
    alpha = 0.28;
  } else if (!alive) {
    inset = 0.04;
    alpha = 0.28;
  }
  const padX = cellW * inset;
  const padY = cellH * inset;
  const sizeW = cellW - padX * 2;
  const sizeH = cellH - padY * 2;
  const bend = style === "logo" ? 0 : Math.min(sizeW, sizeH) * 0.5;
  ctx.globalAlpha = alpha;
  for (let index = 0; index < body.length; index += 1) {
    const segment = body[index];
    ctx.fillStyle = snakeSegmentColor(
      (snake.turboLeft ?? 0) > 0 ? "rainbow" : snake.color,
      index,
      tick,
    );
    fillSegment(
      ctx,
      segment.x * cellW + padX,
      segment.y * cellH + padY,
      sizeW,
      sizeH,
      elbowRadii(body[index - 1], segment, body[index + 1], bend, cols, rows),
    );
  }
  if (style === "normal" && !alive && body[0]) {
    ctx.globalAlpha = 0.7;
    const head = body[0];
    const cx = (head.x + 0.5) * cellW;
    const cy = (head.y + 0.5) * cellH;
    const arm = Math.min(cellW, cellH) * 0.28;
    ctx.strokeStyle = LCD.bg;
    ctx.lineWidth = Math.max(2, Math.min(cellW, cellH) * 0.14);
    ctx.lineCap = "square";
    ctx.beginPath();
    ctx.moveTo(cx - arm, cy - arm);
    ctx.lineTo(cx + arm, cy + arm);
    ctx.moveTo(cx + arm, cy - arm);
    ctx.lineTo(cx - arm, cy + arm);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function paintBomb(
  ctx: CanvasRenderingContext2D,
  bomb: PaintBomb,
  cellW: number,
  cellH: number,
  on: boolean,
): void {
  if (!on) {
    return;
  }
  const left = bomb.x * cellW;
  const top = bomb.y * cellH;
  const inset = 0.18;
  ctx.fillStyle = LCD.pixel;
  ctx.fillRect(
    left + cellW * inset,
    top + cellH * inset,
    cellW * (1 - inset * 2),
    cellH * (1 - inset * 2),
  );
  const spark = Math.min(cellW, cellH) * 0.12;
  ctx.fillRect(left + cellW * 0.08, top + cellH * 0.08, spark, spark);
  ctx.fillRect(left + cellW * 0.8, top + cellH * 0.08, spark, spark);
  ctx.fillRect(left + cellW * 0.08, top + cellH * 0.8, spark, spark);
  ctx.fillRect(left + cellW * 0.8, top + cellH * 0.8, spark, spark);
}

function paintBlastCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dist: number,
  cellW: number,
  cellH: number,
  progress: number,
  on: boolean,
): void {
  if (!on) {
    return;
  }
  const appearAt = dist * 0.18;
  if (progress < appearAt) {
    return;
  }
  const fade = progress > 0.65 ? 1 - (progress - 0.65) / 0.35 : 1;
  const inset = dist === 0 ? 0.06 : 0.14 + progress * 0.08;
  const left = x * cellW;
  const top = y * cellH;
  ctx.globalAlpha = Math.max(0, fade);
  ctx.fillStyle = LCD.pixel;
  ctx.fillRect(
    left + cellW * inset,
    top + cellH * inset,
    cellW * (1 - inset * 2),
    cellH * (1 - inset * 2),
  );
  ctx.fillStyle = LCD.bg;
  const hole = dist === 0 ? 0.28 : 0.34;
  ctx.fillRect(
    left + cellW * hole,
    top + cellH * hole,
    cellW * (1 - hole * 2),
    cellH * (1 - hole * 2),
  );
  ctx.fillStyle = LCD.pixel;
  const spark = Math.min(cellW, cellH) * (0.1 + (1 - dist) * 0.06);
  ctx.fillRect(left + cellW * 0.06, top + cellH * 0.06, spark, spark);
  ctx.fillRect(left + cellW * 0.82, top + cellH * 0.06, spark, spark);
  ctx.fillRect(left + cellW * 0.06, top + cellH * 0.82, spark, spark);
  ctx.fillRect(left + cellW * 0.82, top + cellH * 0.82, spark, spark);
  ctx.globalAlpha = 1;
}

function paintBlast(
  ctx: CanvasRenderingContext2D,
  blast: PaintBlast,
  cols: number,
  rows: number,
  cellW: number,
  cellH: number,
  blastTicks: number,
  tickMs: number,
  lastTickAt: number,
  now: number,
): void {
  const elapsed = Math.max(
    0,
    (blastTicks - blast.life) * tickMs + (now - lastTickAt),
  );
  const duration = Math.max(1, blastTicks * tickMs);
  const progress = Math.min(1, elapsed / duration);
  const flashOn = Math.floor(elapsed / 70) % 2 === 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const x = blast.x + dx;
      const y = blast.y + dy;
      if (x < 0 || y < 0 || x >= cols || y >= rows) {
        continue;
      }
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      paintBlastCell(
        ctx,
        x,
        y,
        dist,
        cellW,
        cellH,
        progress,
        dist === 0 || flashOn,
      );
    }
  }
}

export function paintGrid(
  canvas: HTMLCanvasElement,
  cache: CanvasPaintCache,
  cols: number,
  rows: number,
  snakes: PaintSnake[],
  foods: Point[],
  shots: PaintShot[] = [],
  _prev?: {
    snakes?: PaintSnake[];
    foods?: Point[];
    shots?: PaintShot[];
  } | null,
  _t = 1,
  extras?: PaintGridExtras,
): void {
  const ctx = syncCanvasSize(canvas, cache);
  if (!ctx) {
    return;
  }
  const width = cache.cssW;
  const height = cache.cssH;
  ctx.clearRect(0, 0, width, height);
  if (cols <= 0 || rows <= 0) {
    return;
  }
  const cellW = width / cols;
  const cellH = height / rows;
  const tick = extras?.tick ?? 0;
  const draw = (snake: PaintSnake) => {
    paintOneSnake(ctx, snake, snake.body, cellW, cellH, tick, cols, rows);
  };

  let anyDead = false;
  for (const snake of snakes) {
    if (snake.alive === false && (snake.style ?? "normal") === "normal") {
      anyDead = true;
      break;
    }
  }
  if (anyDead) {
    for (const snake of snakes) {
      if (snake.alive === false) {
        draw(snake);
      }
    }
    for (const snake of snakes) {
      if (snake.alive !== false) {
        draw(snake);
      }
    }
  } else {
    for (const snake of snakes) {
      draw(snake);
    }
  }

  for (const food of foods) {
    paintFood(ctx, food, cellW, cellH);
  }

  const colors = new Map<string, string>();
  for (const snake of snakes) {
    if (snake.id) {
      colors.set(
        snake.id,
        snakeSegmentColor(
          (snake.turboLeft ?? 0) > 0 ? "rainbow" : snake.color,
          0,
          tick,
        ),
      );
    }
  }
  if (shots.length > 0) {
    const padX = cellW * 0.22;
    const padY = cellH * 0.22;
    for (const shot of shots) {
      ctx.fillStyle = colors.get(shot.ownerId) ?? LCD.pixel;
      ctx.fillRect(
        shot.x * cellW + padX,
        shot.y * cellH + padY,
        cellW - padX * 2,
        cellH - padY * 2,
      );
    }
  }

  const bombs = extras?.bombs ?? [];
  const blasts = extras?.blasts ?? [];
  if (bombs.length === 0 && blasts.length === 0) {
    return;
  }
  const fuseTicks = extras?.fuseTicks ?? 1;
  const tickMs = extras?.tickMs ?? 1;
  const lastTickAt = extras?.lastTickAt ?? extras?.now ?? 0;
  const now = extras?.now ?? lastTickAt;
  for (const bomb of bombs) {
    paintBomb(
      ctx,
      bomb,
      cellW,
      cellH,
      bombBlinkOn(bomb.fuse, fuseTicks, tickMs, lastTickAt, now),
    );
  }
  const blastTicks = extras?.blastTicks ?? 1;
  for (const blast of blasts) {
    paintBlast(
      ctx,
      blast,
      cols,
      rows,
      cellW,
      cellH,
      blastTicks,
      tickMs,
      lastTickAt,
      now,
    );
  }
}

export function clearBoard(
  canvas: HTMLCanvasElement,
  cache: CanvasPaintCache,
): void {
  const ctx = syncCanvasSize(canvas, cache);
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, cache.cssW, cache.cssH);
}

export function shouldLerpMp(
  prev: { tick: number; replayIndex: number; status: string } | null,
  next: { tick: number; replayIndex: number; status: string },
): boolean {
  if (prev?.status !== next.status) {
    return false;
  }
  if (next.status === "lobby" || next.status === "countdown") {
    return false;
  }
  if (next.status === "playing") {
    return next.tick - prev.tick === 1;
  }
  if (next.status === "replay") {
    return next.replayIndex - prev.replayIndex === 1;
  }
  return false;
}
