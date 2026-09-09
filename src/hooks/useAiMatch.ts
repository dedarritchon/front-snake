import { useCallback, useEffect, useRef, useState } from "react";

import { snakeAudio } from "../audio/snakeAudio";
import { isDirection, randomSeed } from "../game/engine";
import { mpHudKey } from "../game/hudState";
import {
  advanceCountdown,
  advanceReplay,
  beginReplay,
  beginRound,
  createMpLobby,
  createPackedSnapshotRing,
  MP_COUNTDOWN_MS,
  MP_REPLAY_TICK_MS,
  type MpDeath,
  type MpPlayer,
  type MpSnapshot,
  type MpState,
  queueMpBomb,
  queueMpFire,
  queueMpInput,
  queueMpTurbo,
  shouldPersonalSlowMo,
  shouldSlowMo,
  snapshotMp,
  tickMp,
} from "../game/multiplayerEngine";
import { shouldLerpMp } from "../game/paintBoard";
import { loadPreferredColor } from "../game/snakeColors";
import type { Direction } from "../game/types";
import {
  AI_YOU_ID,
  aiTickMs,
  chooseAiAction,
  createAiPlayers,
  isAiId,
} from "../game/versusAi";

function applyAi(state: MpState): MpState {
  let next = state;
  for (const snake of state.snakes) {
    if (!snake.alive || !isAiId(snake.id)) {
      continue;
    }
    const action = chooseAiAction(next, snake.id);
    next = queueMpInput(next, snake.id, action.dir);
    if (action.turbo) {
      next = queueMpTurbo(next, snake.id);
    }
    if (action.fire) {
      next = queueMpFire(next, snake.id);
    }
  }
  return next;
}

export function useAiMatch(playerName: string) {
  const [players, setPlayers] = useState<MpPlayer[]>(() =>
    createAiPlayers({ name: playerName, color: loadPreferredColor() }),
  );
  const [state, setState] = useState<MpState | null>(null);
  const stateRef = useRef<MpState | null>(null);
  const prevLiveRef = useRef<MpState | null>(null);
  const lastTickAtRef = useRef(0);
  const playersRef = useRef(players);
  playersRef.current = players;
  const nameRef = useRef(playerName);
  nameRef.current = playerName;
  const historyRef = useRef(createPackedSnapshotRing());
  const personalReplayRef = useRef(false);
  const [personalReplay, setPersonalReplay] = useState<{
    frames: MpSnapshot[];
    index: number;
    deaths: MpDeath[];
  } | null>(null);
  const eliminatedRef = useRef(false);
  const [eliminated, setEliminated] = useState(false);

  const commitState = useCallback(
    (next: MpState, options?: { forceHud?: boolean }) => {
      const previous = stateRef.current;
      if (previous && shouldLerpMp(previous, next)) {
        prevLiveRef.current = previous;
        lastTickAtRef.current = performance.now();
      } else if (
        previous &&
        (previous.tick !== next.tick ||
          previous.replayIndex !== next.replayIndex ||
          previous.status !== next.status)
      ) {
        prevLiveRef.current = null;
        lastTickAtRef.current = performance.now();
      }
      if (
        previous &&
        !personalReplayRef.current &&
        shouldPersonalSlowMo(previous, next, AI_YOU_ID)
      ) {
        const crash = snapshotMp(next);
        personalReplayRef.current = true;
        setPersonalReplay({
          frames: [...historyRef.current.unpack(), crash, crash, crash],
          index: 0,
          deaths: next.lastDeaths.filter(
            (death) => death.playerId === AI_YOU_ID,
          ),
        });
      }
      if (next.status === "playing") {
        if (previous?.status !== "playing" || previous.tick !== next.tick) {
          historyRef.current.push(next);
        }
      }
      if (
        next.status === "replay" ||
        next.status === "over" ||
        next.status === "countdown"
      ) {
        personalReplayRef.current = false;
        setPersonalReplay(null);
        historyRef.current.clear();
      }
      const you = next.snakes.find((snake) => snake.id === AI_YOU_ID);
      if (you?.alive) {
        if (eliminatedRef.current) {
          eliminatedRef.current = false;
          setEliminated(false);
        }
      } else if (you && !you.alive && !eliminatedRef.current) {
        eliminatedRef.current = true;
        setEliminated(true);
      }
      stateRef.current = next;
      if (options?.forceHud || mpHudKey(previous) !== mpHudKey(next)) {
        setState(next);
      }
    },
    [],
  );

  const beginMatch = useCallback(() => {
    const seed = randomSeed();
    const roster = createAiPlayers({
      name: nameRef.current,
      color: loadPreferredColor(),
    });
    setPlayers(roster);
    playersRef.current = roster;
    historyRef.current.clear();
    personalReplayRef.current = false;
    setPersonalReplay(null);
    eliminatedRef.current = false;
    setEliminated(false);
    prevLiveRef.current = null;
    commitState(
      beginRound(createMpLobby(roster, seed), seed, {
        resetMatch: true,
      }),
      { forceHud: true },
    );
  }, [commitState]);

  useEffect(() => {
    beginMatch();
  }, [beginMatch]);

  const personalReplayActive = personalReplay !== null;
  useEffect(() => {
    if (!personalReplayActive) {
      return;
    }
    if (state?.status === "replay" || state?.status === "over") {
      return;
    }
    const id = window.setInterval(() => {
      setPersonalReplay((current) => {
        if (!current) {
          return null;
        }
        if (current.index + 1 >= current.frames.length) {
          personalReplayRef.current = false;
          return null;
        }
        return { ...current, index: current.index + 1 };
      });
    }, MP_REPLAY_TICK_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [personalReplayActive, state?.status]);

  useEffect(() => {
    if (state?.status !== "countdown") {
      return;
    }
    const id = window.setInterval(() => {
      const current = stateRef.current;
      if (current?.status !== "countdown") {
        return;
      }
      const next = advanceCountdown(current);
      if (next.status === "playing") {
        snakeAudio.playStart();
      }
      commitState(next);
    }, MP_COUNTDOWN_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [commitState, state?.status]);

  useEffect(() => {
    if (state?.status !== "playing" && state?.status !== "replay") {
      return;
    }
    let last = performance.now();
    let frame = 0;
    const step = () => {
      const now = performance.now();
      const current = stateRef.current;
      if (
        !current ||
        (current.status !== "playing" && current.status !== "replay")
      ) {
        frame = window.requestAnimationFrame(step);
        return;
      }
      const you = current.snakes.find((snake) => snake.id === AI_YOU_ID);
      const fast =
        current.status === "playing" &&
        you?.alive === false &&
        !personalReplayRef.current;
      const delay = aiTickMs(current, fast);
      let next = current;
      let ate = false;
      let died = false;
      while (now - last >= delay) {
        last += delay;
        if (next.status === "replay") {
          next = advanceReplay(next);
          break;
        }
        if (next.status !== "playing") {
          break;
        }
        const queued = applyAi(next);
        const after = tickMp(queued);
        if (
          after.snakes.some(
            (snake, index) => snake.score > queued.snakes[index].score,
          )
        ) {
          ate = true;
        }
        if (
          after.snakes.some(
            (snake, index) => queued.snakes[index].alive && !snake.alive,
          )
        ) {
          died = true;
        }
        if (shouldSlowMo(queued, after)) {
          const crash = snapshotMp(after);
          next = beginReplay(after, [
            ...historyRef.current.unpack(),
            crash,
            crash,
            crash,
          ]);
          break;
        }
        next = after;
        break;
      }
      if (now - last > delay * 4) {
        last = now - delay;
      }
      if (next !== current) {
        if (ate && !fast) {
          snakeAudio.playEat();
        }
        if (died) {
          snakeAudio.playDie();
        }
        commitState(next);
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [commitState, state?.status]);

  useEffect(() => {
    if (state?.status === "playing" || state?.status === "replay") {
      snakeAudio.syncStatus("playing");
    } else if (state?.status === "over") {
      snakeAudio.syncStatus("gameover");
    } else {
      snakeAudio.syncStatus("ready");
    }
  }, [state?.status]);

  const sendDirection = useCallback((direction: Direction) => {
    if (!isDirection(direction)) {
      return;
    }
    void snakeAudio.unlock();
    const current = stateRef.current;
    if (!current) {
      return;
    }
    const next = queueMpInput(current, AI_YOU_ID, direction);
    const changed = next.snakes.some(
      (snake, index) => snake.pending !== current.snakes[index].pending,
    );
    if (changed) {
      snakeAudio.playMove(direction);
    }
    stateRef.current = next;
  }, []);

  const sendFire = useCallback(() => {
    void snakeAudio.unlock();
    const current = stateRef.current;
    if (!current) {
      return;
    }
    stateRef.current = queueMpFire(current, AI_YOU_ID);
  }, []);

  const sendTurbo = useCallback(() => {
    void snakeAudio.unlock();
    const current = stateRef.current;
    if (!current) {
      return;
    }
    stateRef.current = queueMpTurbo(current, AI_YOU_ID);
  }, []);

  const sendBomb = useCallback(() => {
    void snakeAudio.unlock();
    const current = stateRef.current;
    if (!current) {
      return;
    }
    stateRef.current = queueMpBomb(current, AI_YOU_ID);
  }, []);

  const rematch = useCallback(() => {
    const current = stateRef.current;
    if (!current) {
      return;
    }
    if (
      current.status === "playing" ||
      current.status === "replay" ||
      current.status === "countdown"
    ) {
      if (!eliminatedRef.current) {
        return;
      }
    }
    beginMatch();
  }, [beginMatch]);

  const replaySlowMo = useCallback(() => {
    const current = stateRef.current;
    if (current?.status !== "over" || current.replay.length === 0) {
      return;
    }
    commitState(beginReplay(current, current.replay), { forceHud: true });
  }, [commitState]);

  const frame = personalReplay?.frames[personalReplay.index];
  const personalView =
    personalReplay && frame && state?.status === "playing"
      ? {
          snakes: frame.snakes,
          foods: frame.foods,
          shots: frame.shots,
          bombs: frame.bombs,
          deaths: personalReplay.deaths,
        }
      : null;

  return {
    playerId: AI_YOU_ID,
    state,
    liveRef: stateRef,
    prevLiveRef,
    lastTickAtRef,
    players,
    personalView,
    eliminated,
    sendDirection,
    sendFire,
    sendTurbo,
    sendBomb,
    rematch,
    replaySlowMo,
  };
}
