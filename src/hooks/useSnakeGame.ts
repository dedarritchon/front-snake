import {useCallback, useEffect, useRef, useState} from 'react';

import {snakeAudio} from '../audio/snakeAudio';
import {randomSeed} from '../game/engine';
import {
  createFreshState,
  createInitialState,
  queueDirection,
  saveGameState,
  tick,
  tickMsForSnakeLength,
  togglePause,
} from '../game/snakeEngine';
import type {Direction, GameState} from '../game/types';
import type {RankedSession} from '../snakeClient/leaderboard';

interface RankedHandlers {
  start: () => Promise<RankedSession | null>;
  submit: (sessionId: string, directions: Direction[]) => void;
}

export function useSnakeGame(levelId: string, ranked?: RankedHandlers) {
  const [state, setState] = useState<GameState>(() =>
    createInitialState(levelId),
  );
  const [muted, setMuted] = useState(() => snakeAudio.isMuted());
  const [rankedActive, setRankedActive] = useState(false);
  const sessionRef = useRef<RankedSession | null>(null);
  const directionsRef = useRef<Direction[]>([]);
  const startingRef = useRef(false);
  const rankedRef = useRef(ranked);
  rankedRef.current = ranked;

  const tickMs = tickMsForSnakeLength(state.snake.length);

  useEffect(() => {
    sessionRef.current = null;
    directionsRef.current = [];
    setRankedActive(false);
    setState(createInitialState(levelId));
  }, [levelId]);

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

  const beginRun = useCallback(async (direction: Direction) => {
    if (startingRef.current) {
      return;
    }
    startingRef.current = true;
    try {
      snakeAudio.playStart();
      const session = (await rankedRef.current?.start()) ?? null;
      sessionRef.current = session;
      directionsRef.current = [];
      setRankedActive(session !== null);
      const seed = session?.seed ?? randomSeed();
      setState((prev) =>
        queueDirection(createFreshState(prev.levelId, seed), direction),
      );
    } finally {
      startingRef.current = false;
    }
  }, []);

  const setDirection = useCallback(
    (direction: Direction) => {
      void snakeAudio.unlock();
      setState((prev) => {
        if (prev.status === 'gameover' || prev.status === 'ready') {
          void beginRun(direction);
          return prev;
        }
        return queueDirection(prev, direction);
      });
    },
    [beginRun],
  );

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
      if (prev.status === 'ready' || prev.status === 'gameover') {
        void beginRun(
          prev.status === 'ready' ? prev.pendingDirection : 'right',
        );
        return prev;
      }
      return prev;
    });
  }, [beginRun]);

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
        const applied = prev.pendingDirection;
        const next = tick(prev);
        if (next.score > prev.score) {
          snakeAudio.playEat();
        }
        if (next.status === 'playing' || next.status === 'gameover') {
          directionsRef.current.push(applied);
        }
        if (next.status === 'gameover' && prev.status === 'playing') {
          snakeAudio.playDie();
          const session = sessionRef.current;
          if (session) {
            rankedRef.current?.submit(session.sessionId, directionsRef.current);
          }
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

  return {
    state,
    setDirection,
    pause,
    startOrRestart,
    muted,
    toggleMute,
    rankedActive,
  };
}
