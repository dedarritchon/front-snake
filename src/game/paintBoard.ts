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

function lerpAxis(from: Point, to: Point, t: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx !== 0 && dy !== 0) {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const dist = t * (ax + ay);
    if (dist <= ax) {
      return { x: from.x + Math.sign(dx) * dist, y: from.y };
    }
    return { x: to.x, y: from.y + Math.sign(dy) * (dist - ax) };
  }
  return { x: from.x + dx * t, y: from.y + dy * t };
}

export function lerpBodies(
  prev: Point[] | undefined,
  curr: Point[],
  t: number,
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
  const out: Point[] = [lerpAxis(prev[0] ?? curr[0], curr[0], t)];
  if (curr.length === 1) {
    return out;
  }
  if (curr.length > prev.length) {
    for (let i = 1; i < curr.length; i += 1) {
      out.push(curr[i]);
    }
    return out;
  }
  for (let i = 1; i < curr.length - 1; i += 1) {
    out.push(curr[i]);
  }
  const tailFrom = prev[prev.length - 1] ?? curr[curr.length - 1];
  out.push(lerpAxis(tailFrom, curr[curr.length - 1], t));
  return out;
}

function lerpShots(
  prev: PaintShot[] | undefined,
  curr: PaintShot[],
  t: number,
): PaintShot[] {
  if (prev?.length !== curr.length || t >= 1) {
    return curr;
  }
  return curr.map((shot, index) => {
    const from = prev[index];
    if (from.ownerId !== shot.ownerId) {
      return shot;
    }
    return {
      ownerId: shot.ownerId,
      x: from.x + (shot.x - from.x) * t,
      y: from.y + (shot.y - from.y) * t,
    };
  });
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
  ctx.globalAlpha = alpha;
  for (let index = 0; index < body.length; index += 1) {
    const segment = body[index];
    ctx.fillStyle = snakeSegmentColor(snake.color, index, tick);
    ctx.fillRect(
      segment.x * cellW + padX,
      segment.y * cellH + padY,
      sizeW,
      sizeH,
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
  prev?: {
    snakes?: PaintSnake[];
    foods?: Point[];
    shots?: PaintShot[];
  } | null,
  t = 1,
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
  const prevById = new Map<string, PaintSnake>();
  if (prev?.snakes && t < 1) {
    for (const snake of prev.snakes) {
      if (snake.id) {
        prevById.set(snake.id, snake);
      }
    }
  }

  const draw = (snake: PaintSnake) => {
    const from = snake.id ? prevById.get(snake.id) : undefined;
    const body = lerpBodies(from?.body, snake.body, t);
    paintOneSnake(ctx, snake, body, cellW, cellH, tick);
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
      colors.set(snake.id, snakeSegmentColor(snake.color, 0, tick));
    }
  }
  if (shots.length > 0) {
    const drawnShots = lerpShots(prev?.shots, shots, t);
    const padX = cellW * 0.22;
    const padY = cellH * 0.22;
    for (const shot of drawnShots) {
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
