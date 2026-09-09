import { useCallback, useEffect, useRef, useState } from "react";

import { snakeAudio } from "../audio/snakeAudio";
import { randomSeed } from "../game/engine";
import { soloHudKey } from "../game/hudState";
import {
  createFreshState,
  createInitialState,
  queueDirection,
  tick,
  tickMsForScore,
  togglePause,
} from "../game/snakeEngine";
import type { Direction, GameState } from "../game/types";
import type { RankedSession } from "../snakeClient/leaderboard";

interface RankedHandlers {
  start: () => Promise<RankedSession | null>;
  submit: (sessionId: string, directions: Direction[]) => void;
  locked?: boolean;
}

export function useSnakeGame(levelId: string, ranked?: RankedHandlers) {
  const [state, setState] = useState<GameState>(() =>
    createInitialState(levelId),
  );
  const liveRef = useRef(state);
  const prevLiveRef = useRef<GameState | null>(null);
  const lastTickAtRef = useRef(0);
  const [muted, setMuted] = useState(() => snakeAudio.isMuted());
  const [rankedActive, setRankedActive] = useState(false);
  const sessionRef = useRef<RankedSession | null>(null);
  const directionsRef = useRef<Direction[]>([]);
  const startingRef = useRef(false);
  const rankedRef = useRef(ranked);
  rankedRef.current = ranked;

  const commitState = useCallback(
    (next: GameState, options?: { step?: boolean; forceHud?: boolean }) => {
      const previous = liveRef.current;
      if (options?.step) {
        prevLiveRef.current = previous;
        lastTickAtRef.current = performance.now();
      }
      liveRef.current = next;
      if (options?.forceHud || soloHudKey(previous) !== soloHudKey(next)) {
        setState(next);
      }
    },
    [],
  );

  useEffect(() => {
    sessionRef.current = null;
    directionsRef.current = [];
    setRankedActive(false);
    prevLiveRef.current = null;
    const next = createInitialState(levelId);
    liveRef.current = next;
    setState(next);
  }, [levelId]);

  useEffect(() => {
    snakeAudio.syncStatus(state.status);
  }, [state.status]);

  useEffect(() => {
    return () => {
      snakeAudio.shutdown();
    };
  }, []);

  const beginRun = useCallback(
    async (direction: Direction) => {
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
        const prev = liveRef.current;
        const next = queueDirection(
          createFreshState(prev.levelId, seed),
          direction,
        );
        prevLiveRef.current = null;
        commitState(next, { forceHud: true });
      } finally {
        startingRef.current = false;
      }
    },
    [commitState],
  );

  const setDirection = useCallback(
    (direction: Direction) => {
      void snakeAudio.unlock();
      const prev = liveRef.current;
      if (prev.status === "gameover" || prev.status === "ready") {
        void beginRun(direction);
        return;
      }
      const next = queueDirection(prev, direction);
      if (next.pendingDirection !== prev.pendingDirection) {
        snakeAudio.playMove(direction);
      }
      liveRef.current = next;
    },
    [beginRun],
  );

  const pause = useCallback(() => {
    void snakeAudio.unlock();
    const prev = liveRef.current;
    if (prev.status === "playing" || prev.status === "paused") {
      snakeAudio.playPause();
    }
    commitState(togglePause(prev), { forceHud: true });
  }, [commitState]);

  const startOrRestart = useCallback(() => {
    void snakeAudio.unlock();
    const prev = liveRef.current;
    if (prev.status === "ready" || prev.status === "gameover") {
      void beginRun(prev.status === "ready" ? prev.pendingDirection : "right");
    }
  }, [beginRun]);

  const toggleMute = useCallback(() => {
    const next = snakeAudio.toggleMute();
    setMuted(next);
    if (!next) {
      snakeAudio.syncStatus(liveRef.current.status);
    }
  }, []);

  useEffect(() => {
    if (state.status !== "playing") {
      return;
    }

    let last = performance.now();
    let frame = 0;
    const step = () => {
      const now = performance.now();
      const prev = liveRef.current;
      if (prev.status !== "playing") {
        frame = window.requestAnimationFrame(step);
        return;
      }
      const delay = tickMsForScore(prev.score, prev.snake.length);
      while (now - last >= delay) {
        last += delay;
        const current = liveRef.current;
        if (current.status !== "playing") {
          break;
        }
        const applied = current.pendingDirection;
        const next = tick(current);
        if (next.score > current.score) {
          snakeAudio.playEat();
        }
        if (next.status === "playing" || next.status === "gameover") {
          directionsRef.current.push(applied);
        }
        if (next.status === "gameover") {
          snakeAudio.playDie();
          const session = sessionRef.current;
          if (session) {
            rankedRef.current?.submit(session.sessionId, directionsRef.current);
          }
        }
        commitState(next, { step: true });
        break;
      }
      if (now - last > delay * 4) {
        last = now - delay;
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [commitState, state.status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }
      if (rankedRef.current?.locked && event.key.toLowerCase() !== "m") {
        event.preventDefault();
        return;
      }
      const key = event.key.toLowerCase();

      let direction: Direction | null = null;
      if (key === "arrowup" || key === "w") {
        direction = "up";
      } else if (key === "arrowdown" || key === "s") {
        direction = "down";
      } else if (key === "arrowleft" || key === "a") {
        direction = "left";
      } else if (key === "arrowright" || key === "d") {
        direction = "right";
      }

      if (direction) {
        event.preventDefault();
        setDirection(direction);
        return;
      }

      if (key === " " || key === "p") {
        event.preventDefault();
        pause();
        return;
      }

      if (key === "m") {
        event.preventDefault();
        toggleMute();
        return;
      }

      if (key === "enter" || key === "r") {
        event.preventDefault();
        startOrRestart();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [pause, setDirection, startOrRestart, toggleMute]);

  return {
    state,
    liveRef,
    prevLiveRef,
    lastTickAtRef,
    setDirection,
    pause,
    startOrRestart,
    muted,
    toggleMute,
    rankedActive,
  };
}
