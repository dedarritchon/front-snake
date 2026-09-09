import { useCallback, useEffect, useRef, useState } from "react";

import { snakeAudio } from "../audio/snakeAudio";
import { isDirection, randomSeed } from "../game/engine";
import { mpHudKey } from "../game/hudState";
import {
  acceptHostTick,
  advanceCountdown,
  advanceLocalSnake,
  advanceReplay,
  allReadyToStart,
  applyHostSnapshot,
  beginReplay,
  beginRound,
  createMpLobby,
  createPackedSnapshotRing,
  createPlayerId,
  killPlayer,
  markHostLeft,
  MP_COUNTDOWN_MS,
  MP_REPLAY_TICK_MS,
  type MpDeath,
  type MpPlayer,
  type MpSnapshot,
  type MpState,
  mpTickMs,
  queueMpBomb,
  queueMpFire,
  queueMpInput,
  queueMpTurbo,
  shouldCoverLateHost,
  shouldPersonalSlowMo,
  shouldSlowMo,
  snapshotMp,
  tickMp,
} from "../game/multiplayerEngine";
import { shouldLerpMp } from "../game/paintBoard";
import {
  isSnakeColor,
  loadPreferredColor,
  savePreferredColor,
} from "../game/snakeColors";
import type { Direction } from "../game/types";
import {
  MultiplayerRoom,
  roomIdentity,
  type RoomLink,
} from "../snakeClient/multiplayer";

export function useMultiplayerRoom(
  roomId: string,
  playerName: string,
  claimHost: boolean,
) {
  const identityRef = useRef(roomIdentity(roomId, createPlayerId));
  identityRef.current = roomIdentity(roomId, createPlayerId);
  const [state, setState] = useState<MpState | null>(null);
  const [players, setPlayers] = useState<MpPlayer[]>([]);
  const [isHost, setIsHost] = useState(claimHost);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<RoomLink>("connecting");

  const stateRef = useRef<MpState | null>(null);
  const prevLiveRef = useRef<MpState | null>(null);
  const lastTickAtRef = useRef(0);
  const isHostRef = useRef(isHost);
  const playersRef = useRef(players);
  const readyRef = useRef(ready);
  const roomRef = useRef<MultiplayerRoom | null>(null);
  const nameRef = useRef(playerName);
  const sentOverReplayRef = useRef(false);
  nameRef.current = playerName;
  isHostRef.current = isHost;
  playersRef.current = players;
  readyRef.current = ready;

  const historyRef = useRef(createPackedSnapshotRing());
  const personalReplayRef = useRef(false);
  const localReplayRef = useRef(false);
  const lastHostAtRef = useRef(0);
  const lastHostTickRef = useRef(-1);
  const aheadRef = useRef(false);
  const [personalReplay, setPersonalReplay] = useState<{
    frames: MpSnapshot[];
    index: number;
    deaths: MpDeath[];
  } | null>(null);

  const commitState = useCallback(
    (
      next: MpState,
      options?: {
        send?: boolean;
        forceHud?: boolean;
        resync?: boolean;
        predict?: boolean;
      },
    ) => {
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

      const me = identityRef.current.playerId;
      if (
        previous &&
        !personalReplayRef.current &&
        shouldPersonalSlowMo(previous, next, me)
      ) {
        const crash = snapshotMp(next);
        personalReplayRef.current = true;
        setPersonalReplay({
          frames: [...historyRef.current.unpack(), crash, crash, crash],
          index: 0,
          deaths: next.lastDeaths.filter((death) => death.playerId === me),
        });
      }
      if (next.status === "playing" && options?.predict !== true) {
        if (previous?.status !== "playing" || previous.tick !== next.tick) {
          historyRef.current.push(next);
        }
      }
      if (
        next.status === "replay" ||
        next.status === "over" ||
        next.status === "lobby" ||
        next.status === "countdown"
      ) {
        personalReplayRef.current = false;
        setPersonalReplay(null);
        historyRef.current.clear();
      }

      stateRef.current = next;
      if (options?.send) {
        queueMicrotask(() => {
          const latest = stateRef.current;
          if (!latest) {
            return;
          }
          const includeReplay =
            latest.status === "over" &&
            (options.resync === true || !sentOverReplayRef.current);
          if (latest.status === "over" && includeReplay) {
            sentOverReplayRef.current = true;
          }
          if (latest.status !== "over") {
            sentOverReplayRef.current = false;
          }
          roomRef.current?.sendState(latest, { includeReplay });
        });
      }
      if (options?.forceHud || mpHudKey(previous) !== mpHudKey(next)) {
        setState(next);
      }
    },
    [],
  );
  const publish = useCallback(
    (next: MpState) => {
      commitState(next, { send: true });
    },
    [commitState],
  );
  const publishRef = useRef(publish);
  publishRef.current = publish;

  const clearReady = useCallback(() => {
    if (!readyRef.current) {
      return;
    }
    readyRef.current = false;
    setReady(false);
    void roomRef.current?.setReady(false);
  }, []);
  const clearReadyRef = useRef(clearReady);
  clearReadyRef.current = clearReady;

  const beginMatch = useCallback(() => {
    if (!isHostRef.current || !allReadyToStart(playersRef.current)) {
      return;
    }
    const seed = randomSeed();
    historyRef.current.clear();
    personalReplayRef.current = false;
    setPersonalReplay(null);
    publish(
      beginRound(createMpLobby(playersRef.current, seed), seed, {
        resetMatch: true,
      }),
    );
    clearReady();
  }, [clearReady, publish]);
  const beginMatchRef = useRef(beginMatch);
  beginMatchRef.current = beginMatch;

  useEffect(() => {
    let cancelled = false;
    const identity = identityRef.current;
    const room = new MultiplayerRoom(
      roomId,
      {
        playerId: identity.playerId,
        name: nameRef.current,
        color: loadPreferredColor(),
        host: claimHost,
        ready: false,
        joinedAt: identity.joinedAt,
      },
      {
        onLink: (next) => {
          if (!cancelled) {
            setLink(next);
            if (next === "connected") {
              setError(null);
            }
          }
        },
        onResynced: () => {
          if (cancelled || !isHostRef.current) {
            return;
          }
          const current = stateRef.current;
          if (current) {
            sentOverReplayRef.current = false;
            room.sendState(current, { includeReplay: true });
            if (current.status === "over") {
              sentOverReplayRef.current = true;
            }
          }
        },
        onRoster: (nextPlayers, hostId) => {
          if (cancelled) {
            return;
          }
          setPlayers(nextPlayers);
          playersRef.current = nextPlayers;
          const mine = nextPlayers.find(
            (player) => player.id === identity.playerId,
          );
          if (mine && mine.color !== room.claimedColor()) {
            void room.setColor(mine.color);
          }
          const current = stateRef.current;
          const inMatch =
            current?.status === "playing" ||
            current?.status === "countdown" ||
            current?.status === "replay";
          const nowHost =
            hostId === identity.playerId ||
            (!hostId &&
              !inMatch &&
              current?.status !== "over" &&
              nextPlayers[0]?.id === identity.playerId);
          if (nowHost && !isHostRef.current) {
            void room.setHost(true);
          }
          isHostRef.current = nowHost;
          setIsHost(nowHost);

          if (nowHost) {
            if (!current || current.status === "lobby") {
              publishRef.current(
                createMpLobby(nextPlayers, current?.seed ?? randomSeed()),
              );
            } else if (
              current.status === "playing" ||
              current.status === "countdown"
            ) {
              let next = current;
              for (const snake of current.snakes) {
                if (
                  snake.alive &&
                  !nextPlayers.some((player) => player.id === snake.id)
                ) {
                  next = killPlayer(next, snake.id);
                }
              }
              if (next !== current) {
                publishRef.current(next);
              }
            }
            if (allReadyToStart(nextPlayers)) {
              const latest = stateRef.current;
              if (
                !latest ||
                latest.status === "lobby" ||
                latest.status === "over"
              ) {
                beginMatchRef.current();
              }
            }
            return;
          }

          if (
            !hostId &&
            current &&
            (current.status === "playing" ||
              current.status === "countdown" ||
              current.status === "lobby")
          ) {
            const left = markHostLeft(current);
            commitState(left, { forceHud: true });
          }
        },
        onState: (next) => {
          if (cancelled || isHostRef.current) {
            return;
          }
          if (localReplayRef.current && next.status === "over") {
            return;
          }
          localReplayRef.current = false;
          const current = stateRef.current;
          if (!acceptHostTick(lastHostTickRef.current, next, current?.status)) {
            return;
          }
          lastHostTickRef.current = next.tick;
          lastHostAtRef.current = performance.now();
          aheadRef.current = false;
          const applied = applyHostSnapshot(next, current, identity.playerId);
          if (current?.status === "playing" && applied.status === "playing") {
            if (
              applied.snakes.some(
                (snake, index) => snake.score > current.snakes[index].score,
              )
            ) {
              snakeAudio.playEat();
            }
            if (
              applied.snakes.some(
                (snake, index) => current.snakes[index].alive && !snake.alive,
              )
            ) {
              snakeAudio.playDie();
            }
          }
          commitState(applied);
          if (next.status === "playing" || next.status === "countdown") {
            clearReadyRef.current();
          }
        },
        onInput: (input) => {
          if (!isHostRef.current) {
            return;
          }
          const current = stateRef.current;
          if (!current) {
            return;
          }
          const next =
            input.kind === "fire"
              ? queueMpFire(current, input.playerId)
              : input.kind === "turbo"
                ? queueMpTurbo(current, input.playerId)
                : input.kind === "bomb"
                  ? queueMpBomb(current, input.playerId)
                  : queueMpInput(current, input.playerId, input.dir);
          stateRef.current = next;
        },
        onStart: () => {
          if (!isHostRef.current) {
            snakeAudio.playStart();
            clearReadyRef.current();
          }
        },
      },
    );
    roomRef.current = room;
    void room.connect().catch(() => {
      if (!cancelled) {
        setError("Could not join room");
      }
    });

    return () => {
      cancelled = true;
      roomRef.current = null;
      void room.disconnect();
    };
  }, [claimHost, roomId, commitState]);

  useEffect(() => {
    void roomRef.current?.setName(playerName);
  }, [playerName]);

  useEffect(() => {
    historyRef.current = createPackedSnapshotRing();
    prevLiveRef.current = null;
    personalReplayRef.current = false;
    lastHostAtRef.current = 0;
    lastHostTickRef.current = -1;
    aheadRef.current = false;
    sentOverReplayRef.current = false;
    setPersonalReplay(null);
  }, [roomId]);

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
    if (!isHost || state?.status !== "countdown") {
      return;
    }
    const id = window.setInterval(() => {
      if (!isHostRef.current) {
        return;
      }
      const current = stateRef.current;
      if (current?.status !== "countdown") {
        return;
      }
      const next = advanceCountdown(current);
      if (next.status === "playing") {
        snakeAudio.playStart();
        roomRef.current?.sendStart(current.seed);
      }
      publish(next);
    }, MP_COUNTDOWN_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [isHost, publish, state?.status]);

  useEffect(() => {
    if (isHost || state?.status !== "playing") {
      return;
    }
    let frame = 0;
    const step = () => {
      const current = stateRef.current;
      if (current?.status === "playing") {
        const now = performance.now();
        if (
          shouldCoverLateHost(
            aheadRef.current,
            now,
            lastHostAtRef.current,
            mpTickMs(current),
          )
        ) {
          const next = advanceLocalSnake(current, identityRef.current.playerId);
          if (next !== current) {
            aheadRef.current = true;
            commitState(next, { predict: true });
          }
        }
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [commitState, isHost, state?.status]);

  useEffect(() => {
    const playing = state?.status === "playing";
    const replaying = state?.status === "replay";
    const hostLive = isHost && (playing || replaying);
    const localClip = replaying && localReplayRef.current;
    if (!hostLive && !localClip) {
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
      if (
        current.status === "replay" &&
        !isHostRef.current &&
        !localReplayRef.current
      ) {
        frame = window.requestAnimationFrame(step);
        return;
      }
      const delay = mpTickMs(current);
      let next = current;
      let ate = false;
      let died = false;
      while (now - last >= delay) {
        last += delay;
        if (next.status === "replay") {
          next = advanceReplay(next);
          if (next.status === "over") {
            localReplayRef.current = false;
          }
          break;
        }
        if (next.status !== "playing") {
          break;
        }
        const after = tickMp(next);
        if (
          after.snakes.some(
            (snake, index) => snake.score > next.snakes[index].score,
          )
        ) {
          ate = true;
        }
        if (
          after.snakes.some(
            (snake, index) => next.snakes[index].alive && !snake.alive,
          )
        ) {
          died = true;
        }
        if (shouldSlowMo(next, after)) {
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
        if (ate) {
          snakeAudio.playEat();
        }
        if (died) {
          snakeAudio.playDie();
        }
        if (isHostRef.current && !localReplayRef.current) {
          publish(next);
        } else {
          commitState(next);
        }
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [commitState, isHost, publish, state?.status]);

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
    const next = queueMpInput(current, identityRef.current.playerId, direction);
    if (next === current) {
      return;
    }
    snakeAudio.playMove(direction);
    stateRef.current = next;
    if (!isHostRef.current) {
      roomRef.current?.sendInput(direction);
    }
  }, []);

  const sendFire = useCallback(() => {
    void snakeAudio.unlock();
    const current = stateRef.current;
    if (!current) {
      return;
    }
    const next = queueMpFire(current, identityRef.current.playerId);
    if (next === current) {
      return;
    }
    stateRef.current = next;
    if (!isHostRef.current) {
      roomRef.current?.sendFire();
    }
  }, []);

  const sendTurbo = useCallback(() => {
    void snakeAudio.unlock();
    const current = stateRef.current;
    if (!current) {
      return;
    }
    const next = queueMpTurbo(current, identityRef.current.playerId);
    if (next === current) {
      return;
    }
    stateRef.current = next;
    if (!isHostRef.current) {
      roomRef.current?.sendTurbo();
    }
  }, []);

  const sendBomb = useCallback(() => {
    void snakeAudio.unlock();
    const current = stateRef.current;
    if (!current) {
      return;
    }
    const next = queueMpBomb(current, identityRef.current.playerId);
    if (next === current) {
      return;
    }
    stateRef.current = next;
    if (!isHostRef.current) {
      roomRef.current?.sendBomb();
    }
  }, []);

  const toggleReady = useCallback(() => {
    const status = stateRef.current?.status ?? "lobby";
    if (status === "playing" || status === "replay" || status === "countdown") {
      return;
    }
    const next = !readyRef.current;
    readyRef.current = next;
    setReady(next);
    void roomRef.current?.setReady(next);
  }, []);

  const setColor = useCallback((color: string) => {
    const status = stateRef.current?.status ?? "lobby";
    if (status === "playing" || status === "replay" || status === "countdown") {
      return;
    }
    if (!isSnakeColor(color)) {
      return;
    }
    const me = identityRef.current.playerId;
    if (
      playersRef.current.some(
        (player) => player.id !== me && player.color === color,
      )
    ) {
      return;
    }
    savePreferredColor(color);
    void roomRef.current?.setColor(color);
  }, []);

  const replaySlowMo = useCallback(() => {
    const current = stateRef.current;
    if (current?.status !== "over" || current.replay.length === 0) {
      return;
    }
    localReplayRef.current = true;
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
          blasts: frame.blasts,
          deaths: personalReplay.deaths,
        }
      : null;

  return {
    playerId: identityRef.current.playerId,
    state,
    liveRef: stateRef,
    prevLiveRef,
    lastTickAtRef,
    players,
    isHost,
    ready,
    error,
    link,
    connected: link === "connected",
    personalView,
    sendDirection,
    sendFire,
    sendTurbo,
    sendBomb,
    toggleReady,
    setColor,
    replaySlowMo,
    getNetBps: () => roomRef.current?.throughput() ?? 0,
  };
}
