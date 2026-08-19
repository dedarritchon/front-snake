import {useCallback, useEffect, useRef, useState} from 'react';

import {snakeAudio} from '../audio/snakeAudio';
import {
  createFreshState,
  createInitialState,
  type GridSize,
  queueDirection,
  saveGameState,
  tick,
  tickMsForSnakeLength,
  togglePause,
} from '../game/snakeEngine';
import type {Direction, GameState} from '../game/types';

export function useSnakeGame(levelId: string, gridSize: GridSize) {
  const gridRef = useRef(gridSize);
  gridRef.current = gridSize;

  const [state, setState] = useState<GameState>(() =>
    createInitialState(levelId, gridSize.gridWidth, gridSize.gridHeight),
  );
  const [muted, setMuted] = useState(() => snakeAudio.isMuted());

  const tickMs = tickMsForSnakeLength(state.snake.length);

  useEffect(() => {
    setState(createInitialState(levelId, gridRef.current.gridWidth, gridRef.current.gridHeight));
  }, [levelId]);

  useEffect(() => {
    setState((prev) => {
      if (prev.status !== 'ready' && prev.status !== 'gameover') {
        return prev;
      }
      if (prev.gridWidth === gridSize.gridWidth && prev.gridHeight === gridSize.gridHeight) {
        return prev;
      }
      if (prev.status === 'ready' && prev.score === 0) {
        return createFreshState(prev.levelId, gridSize.gridWidth, gridSize.gridHeight);
      }
      if (prev.status === 'gameover') {
        return createFreshState(prev.levelId, gridSize.gridWidth, gridSize.gridHeight);
      }
      return prev;
    });
  }, [gridSize.gridWidth, gridSize.gridHeight]);

  useEffect(() => {
    saveGameState(state);
  }, [state]);

  useEffect(() => {
    snakeAudio.syncStatus(state.status);
  }, [state.status]);

  useEffect(() => {
    return () => {
      snakeAudio.syncStatus('paused');
    };
  }, []);

  const setDirection = useCallback((direction: Direction) => {
    void snakeAudio.unlock();
    setState((prev) => {
      if (prev.status === 'gameover') {
        const {gridWidth, gridHeight} = gridRef.current;
        snakeAudio.playStart();
        return queueDirection(createFreshState(prev.levelId, gridWidth, gridHeight), direction);
      }
      if (prev.status === 'ready') {
        snakeAudio.playStart();
      }
      return queueDirection(prev, direction);
    });
  }, []);

  const pause = useCallback(() => {
    void snakeAudio.unlock();
    setState((prev) => {
      if (prev.status === 'playing' || prev.status === 'paused') {
        snakeAudio.playPause();
      }
      return togglePause(prev);
    });
  }, []);

  const startOrRestart = useCallback(() => {
    void snakeAudio.unlock();
    setState((prev) => {
      if (prev.status === 'ready') {
        snakeAudio.playStart();
        return queueDirection(prev, prev.pendingDirection);
      }
      const {gridWidth, gridHeight} = gridRef.current;
      snakeAudio.playStart();
      return queueDirection(createFreshState(prev.levelId, gridWidth, gridHeight), 'right');
    });
  }, []);

  const toggleMute = useCallback(() => {
    const next = snakeAudio.toggleMute();
    setMuted(next);
    if (!next && state.status === 'playing') {
      snakeAudio.syncStatus('playing');
    }
  }, [state.status]);

  useEffect(() => {
    if (state.status !== 'playing') {
      return;
    }

    const id = window.setInterval(() => {
      setState((prev) => {
        const next = tick(prev);
        if (next.score > prev.score) {
          snakeAudio.playEat();
        }
        if (next.status === 'gameover' && prev.status === 'playing') {
          snakeAudio.playDie();
        }
        return next;
      });
    }, tickMs);

    return () => {
      window.clearInterval(id);
    };
  }, [state.status, tickMs]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      let direction: Direction | null = null;
      if (key === 'arrowup' || key === 'w') {
        direction = 'up';
      } else if (key === 'arrowdown' || key === 's') {
        direction = 'down';
      } else if (key === 'arrowleft' || key === 'a') {
        direction = 'left';
      } else if (key === 'arrowright' || key === 'd') {
        direction = 'right';
      }

      if (direction) {
        event.preventDefault();
        setDirection(direction);
        return;
      }

      if (key === ' ' || key === 'p') {
        event.preventDefault();
        pause();
        return;
      }

      if (key === 'm') {
        event.preventDefault();
        toggleMute();
        return;
      }

      if (key === 'enter' || key === 'r') {
        event.preventDefault();
        startOrRestart();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [pause, setDirection, startOrRestart, toggleMute]);

  return {state, setDirection, pause, startOrRestart, muted, toggleMute};
}
