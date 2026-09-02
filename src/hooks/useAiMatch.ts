import { useCallback, useEffect, useRef, useState } from "react";

import { snakeAudio } from "../audio/snakeAudio";
import { isDirection, randomSeed } from "../game/engine";
import {
  advanceCountdown,
  advanceReplay,
  beginReplay,
  beginRound,
  createMpLobby,
  MP_COUNTDOWN_MS,
  MP_REPLAY_FRAMES,
  MP_REPLAY_TICK_MS,
  type MpDeath,
  type MpPlayer,
  type MpSnapshot,
  type MpState,
  queueMpFire,
  queueMpInput,
  queueMpTurbo,
  shouldPersonalSlowMo,
  shouldSlowMo,
  snapshotMp,
  tickMp,
} from "../game/multiplayerEngine";
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
  const stateRef = useRef(state);
  stateRef.current = state;
  const playersRef = useRef(players);
  playersRef.current = players;
  const nameRef = useRef(playerName);
  nameRef.current = playerName;
  const historyRef = useRef<MpSnapshot[]>([]);
  const prevStateRef = useRef<MpState | null>(null);
  const personalReplayRef = useRef(false);
  const [personalReplay, setPersonalReplay] = useState<{
    frames: MpSnapshot[];
    index: number;
    deaths: MpDeath[];
  } | null>(null);
  const eliminatedRef = useRef(false);
  const [eliminated, setEliminated] = useState(false);

  const beginMatch = useCallback(() => {
    const seed = randomSeed();
    const roster = createAiPlayers({
      name: nameRef.current,
      color: loadPreferredColor(),
    });
    setPlayers(roster);
    playersRef.current = roster;
    historyRef.current = [];
    personalReplayRef.current = false;
    setPersonalReplay(null);
    eliminatedRef.current = false;
    setEliminated(false);
    const next = beginRound(createMpLobby(roster, seed), seed, {
      resetMatch: true,
    });
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    beginMatch();
  }, [beginMatch]);

  useEffect(() => {
    const previous = prevStateRef.current;
    if (
      previous &&
      state &&
      !personalReplayRef.current &&
      shouldPersonalSlowMo(previous, state, AI_YOU_ID)
    ) {
      const crash = snapshotMp(state);
      personalReplayRef.current = true;
      setPersonalReplay({
        frames: [...historyRef.current, crash, crash, crash],
        index: 0,
        deaths: state.lastDeaths.filter(
          (death) => death.playerId === AI_YOU_ID,
        ),
      });
    }
    if (state?.status === "playing") {
      if (previous?.status !== "playing" || previous.tick !== state.tick) {
        historyRef.current = [
          ...historyRef.current.slice(-(MP_REPLAY_FRAMES - 1)),
          snapshotMp(state),
        ];
      }
    }
    if (
      state?.status === "replay" ||
      state?.status === "over" ||
      state?.status === "countdown"
    ) {
      personalReplayRef.current = false;
      setPersonalReplay(null);
      historyRef.current = [];
    }
    prevStateRef.current = state;
    const you = state?.snakes.find((snake) => snake.id === AI_YOU_ID);
    if (you?.alive) {
      eliminatedRef.current = false;
      setEliminated(false);
    } else if (you && !you.alive && !eliminatedRef.current) {
      eliminatedRef.current = true;
      setEliminated(true);
    }
  }, [state]);

  useEffect(() => {
    if (!personalReplay) {
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
  }, [personalReplay !== null, state?.status]);

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
      stateRef.current = next;
      setState(next);
    }, MP_COUNTDOWN_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [state?.status]);

  useEffect(() => {
    if (state?.status !== "playing" && state?.status !== "replay") {
      return;
    }
    let last = performance.now();
    let frame = 0;
    const step = (now: number) => {
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
      let stepped = 0;
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
            ...historyRef.current,
            crash,
            crash,
            crash,
          ]);
          break;
        }
        next = after;
        stepped += 1;
        if (!fast || stepped >= 4) {
          break;
        }
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
        stateRef.current = next;
        setState(next);
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [state?.status]);

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
    const next = beginReplay(current, current.replay);
    stateRef.current = next;
    setState(next);
  }, []);

  const frame = personalReplay?.frames[personalReplay.index];
  const personalView =
    personalReplay && frame && state?.status === "playing"
      ? {
          snakes: frame.snakes,
          foods: frame.foods,
          shots: frame.shots,
          deaths: personalReplay.deaths,
        }
      : null;

  return {
    playerId: AI_YOU_ID,
    state,
    players,
    personalView,
    eliminated,
    sendDirection,
    sendFire,
    sendTurbo,
    rematch,
    replaySlowMo,
  };
}
