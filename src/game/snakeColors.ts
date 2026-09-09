export const SNAKE_COLORS = [
  '#2a3816',
  '#2b6cb0',
  '#d4531e',
  '#8b3aaf',
  '#0f8a7a',
  '#9f1239',
  'coral',
  'krait',
  'coral3',
] as const;

export type SnakeColor = (typeof SNAKE_COLORS)[number];

export const DEFAULT_SNAKE_COLOR: SnakeColor = SNAKE_COLORS[0];

const STORAGE_KEY = 'front-snake-color';

const CORAL_RED = '#c1121f';
const BAND_BLACK = '#111111';
const KRAIT_YELLOW = '#f4d35e';
const CORAL3 = [CORAL_RED, KRAIT_YELLOW, BAND_BLACK] as const;

export function isSnakeColor(value: unknown): value is SnakeColor {
  return (
    typeof value === 'string' &&
    (SNAKE_COLORS as readonly string[]).includes(value)
  );
}

export function nextFreeColor(
  taken: ReadonlySet<string>,
  preferred?: string,
): SnakeColor {
  if (preferred && isSnakeColor(preferred) && !taken.has(preferred)) {
    return preferred;
  }
  return SNAKE_COLORS.find((color) => !taken.has(color)) ?? DEFAULT_SNAKE_COLOR;
}

export function assignUniqueColors<T extends {color: string}>(players: T[]): T[] {
  const taken = new Set<string>();
  return players.map((player) => {
    const color = nextFreeColor(taken, player.color);
    taken.add(color);
    return {...player, color};
  });
}

export function loadPreferredColor(): SnakeColor {
  try {
    const value = globalThis.localStorage.getItem(STORAGE_KEY);
    if (isSnakeColor(value)) {
      return value;
    }
  } catch {
    // Private mode / missing storage.
  }
  return DEFAULT_SNAKE_COLOR;
}

export function savePreferredColor(color: string): void {
  if (!isSnakeColor(color)) {
    return;
  }
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, color);
  } catch {
    // Private mode / missing storage.
  }
}

export function snakeSwatch(color: string): string {
  if (color === 'coral') {
    return `repeating-linear-gradient(90deg, ${CORAL_RED} 0 50%, ${BAND_BLACK} 50% 100%)`;
  }
  if (color === 'krait') {
    return `repeating-linear-gradient(90deg, ${KRAIT_YELLOW} 0 50%, ${BAND_BLACK} 50% 100%)`;
  }
  if (color === 'coral3') {
    return `repeating-linear-gradient(90deg, ${CORAL_RED} 0 33%, ${KRAIT_YELLOW} 33% 66%, ${BAND_BLACK} 66% 100%)`;
  }
  if (color === 'rainbow') {
    return 'linear-gradient(90deg, #c1121f, #f4d35e, #2a9d8f, #2b6cb0, #8b3aaf)';
  }
  return color;
}

export function snakeSegmentColor(
  color: string,
  index: number,
  tick: number,
): string {
  if (color === 'coral') {
    return index % 2 === 0 ? CORAL_RED : BAND_BLACK;
  }
  if (color === 'krait') {
    return index % 2 === 0 ? KRAIT_YELLOW : BAND_BLACK;
  }
  if (color === 'coral3') {
    return CORAL3[index % CORAL3.length];
  }
  if (color === 'rainbow') {
    const hue = (((tick - index) * 40) % 360 + 360) % 360;
    return `hsl(${hue} 80% 38%)`;
  }
  return color;
}
