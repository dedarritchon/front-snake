export const SNAKE_COLORS = [
  '#2a3816',
  '#2b6cb0',
  '#d4531e',
  '#8b3aaf',
  '#0f8a7a',
  '#9f1239',
] as const;

export type SnakeColor = (typeof SNAKE_COLORS)[number];

export const DEFAULT_SNAKE_COLOR: SnakeColor = SNAKE_COLORS[0];

const STORAGE_KEY = 'front-snake-color';

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
