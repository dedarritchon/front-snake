import {useCallback, useEffect, useRef, useState} from 'react';

import {snakeAudio} from '../audio/snakeAudio';
import {isDirection, randomSeed} from '../game/engine';
import {
  advanceReplay,
  beginReplay,
  createMpLobby,
  MP_REPLAY_FRAMES,
  MP_REPLAY_TICK_MS,
  MP_TICK_MS,
  type MpDeath,
  type MpPlayer,
  type MpSnapshot,
  type MpState,
  queueMpFire,
  queueMpInput,
  shouldPersonalSlowMo,
  shouldSlowMo,
  snapshotMp,
  startMp,
  tickMp,
} from '../game/multiplayerEngine';
import {loadPreferredColor} from '../game/snakeColors';
import type {Direction} from '../game/types';
import {
  AI_YOU_ID,
  chooseAiAction,
  createAiPlayers,
  isAiId,
} from '../game/versusAi';

function applyAi(state: MpState): MpState {
  let next = state;
  for (const snake of state.snakes) {
    if (!snake.alive || !isAiId(snake.id)) {
      continue;
    }
    const action = chooseAiAction(next, snake.id);
    next = queueMpInput(next, snake.id, action.dir);
    if (action.fire) {
      next = queueMpFire(next, snake.id);
    }
  }
  return next;
}

export function useAiMatch(playerName: string) {
  const [players, setPlayers] = useState<MpPlayer[]>(() =>
    createAiPlayers({name: playerName, color: loadPreferredColor()}),
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
    snakeAudio.playStart();
    const next = startMp(createMpLobby(roster, seed), seed);
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
        deaths: state.lastDeaths.filter((death) => death.playerId === AI_YOU_ID),
      });
    }
    if (state?.status === 'playing') {
      if (previous?.status !== 'playing' || previous.tick !== state.tick) {
        historyRef.current = [
          ...historyRef.current.slice(-(MP_REPLAY_FRAMES - 1)),
          snapshotMp(state),
        ];
      }
    }
    if (state?.status === 'replay' || state?.status === 'over') {
      personalReplayRef.current = false;
      setPersonalReplay(null);
      historyRef.current = [];
    }
    prevStateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!personalReplay) {
      return;
    }
    if (state?.status === 'replay' || state?.status === 'over') {
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
        return {...current, index: current.index + 1};
      });
    }, MP_REPLAY_TICK_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [personalReplay !== null, state?.status]);

  useEffect(() => {
    if (state?.status !== 'playing' && state?.status !== 'replay') {
      return;
    }
    let last = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const current = stateRef.current;
      if (
        !current ||
        (current.status !== 'playing' && current.status !== 'replay')
      ) {
        frame = window.requestAnimationFrame(step);
        return;
      }
      const delay =
        current.status === 'replay' ? MP_REPLAY_TICK_MS : MP_TICK_MS;
      let next = current;
      let ate = false;
      let died = false;
      let ticks = 0;
      while (now - last >= delay) {
        last += delay;
        ticks += 1;
        if (next.status === 'replay') {
          next = advanceReplay(next);
          break;
        }
        if (next.status !== 'playing') {
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
        if (ticks > 5) {
          last = now;
          break;
        }
      }
      if (next !== current) {
        if (ate) {
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
    if (state?.status === 'playing' || state?.status === 'replay') {
      snakeAudio.syncStatus('playing');
    } else if (state?.status === 'over') {
      snakeAudio.syncStatus('gameover');
    } else {
      snakeAudio.syncStatus('ready');
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

  const rematch = useCallback(() => {
    if (stateRef.current?.status === 'playing' || stateRef.current?.status === 'replay') {
      return;
    }
    beginMatch();
  }, [beginMatch]);

  const replaySlowMo = useCallback(() => {
    const current = stateRef.current;
    if (!current || current.status !== 'over' || current.replay.length === 0) {
      return;
    }
    const next = beginReplay(current, current.replay);
    stateRef.current = next;
    setState(next);
  }, []);

  const frame = personalReplay?.frames[personalReplay.index];
  const personalView =
    personalReplay && frame && state?.status === 'playing'
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
    sendDirection,
    sendFire,
    rematch,
    replaySlowMo,
  };
}
