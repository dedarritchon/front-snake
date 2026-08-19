import {createSimState, randomSeed} from './engine';
import type {GameState} from './types';

export {
  gameLevel,
  GRID_HEIGHT,
  GRID_WIDTH,
  queueDirection,
  tick,
  tickMsForScore,
  togglePause,
} from './engine';

export const LOBBY_LEVEL_ID = 'lobby';

export function createFreshState(
  levelId: string,
  seed = randomSeed(),
): GameState {
  return createSimState(levelId, seed);
}

export function createInitialState(levelId: string): GameState {
  return createFreshState(levelId);
}
