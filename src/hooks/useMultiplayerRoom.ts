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
  MP_HUMILIATION_TICKS,
  MP_REPLAY_TICK_MS,
  type MpDeath,
  type MpPlayer,
  type MpSnapshot,
  type MpState,
  mpTickMs,
  queueMpBomb,
  queueMpFire,
  queueMpInput,
  queueMpShed,
  queueMpTurbo,
  shouldPersonalSlowMo,
  shouldPredictLocalTick,
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
import { createNetStats, logNet } from "../snakeClient/netDebug";

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
  const lastHostTickRef = useRef(-1);
  const guestClockRef = useRef(0);
  const aheadRef = useRef(false);
  const lastSnapAtRef = useRef(0);
  const netStatsRef = useRef(createNetStats());
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

  const predictLocal = useCallback(() => {
    if (isHostRef.current) {
      return;
    }
    const latest = stateRef.current;
    if (
      latest?.status !== "playing" ||
      !shouldPredictLocalTick(latest.tick, lastHostTickRef.current)
    ) {
      return;
    }
    const next = advanceLocalSnake(latest, identityRef.current.playerId);
    if (next === latest) {
      return;
    }
    aheadRef.current = true;
    logNet("predict", {
      tick: next.tick,
      host: lastHostTickRef.current,
    });
    netStatsRef.current.recordPredict();
    commitState(next, { predict: true });
  }, [commitState]);
  const predictLocalRef = useRef(predictLocal);
  predictLocalRef.current = predictLocal;

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
            logNet("link", {
              status: next,
              room: roomId,
              you: identity.playerId,
              host: isHostRef.current,
            });
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
          if (nowHost !== isHostRef.current) {
            logNet("role", {
              host: nowHost,
              you: identity.playerId,
              players: nextPlayers.length,
            });
          }
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
        onState: (next, bytes) => {
          if (cancelled || isHostRef.current) {
            return;
          }
          if (localReplayRef.current && next.status === "over") {
            return;
          }
          localReplayRef.current = false;
          const current = stateRef.current;
          if (!acceptHostTick(lastHostTickRef.current, next, current?.status)) {
            netStatsRef.current.recordDrop();
            logNet("drop", {
              tick: next.tick,
              last: lastHostTickRef.current,
              status: next.status,
            });
            return;
          }
          const now = performance.now();
          const dt =
            lastSnapAtRef.current > 0
              ? Math.round(now - lastSnapAtRef.current)
              : 0;
          const gap =
            lastHostTickRef.current >= 0
              ? next.tick - lastHostTickRef.current
              : 0;
          logNet("snap", {
            tick: next.tick,
            dt,
            gap,
            status: next.status,
            bytes,
            ahead: aheadRef.current,
          });
          netStatsRef.current.recordSnap(dt, bytes);
          lastSnapAtRef.current = now;
          lastHostTickRef.current = next.tick;
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
            if (
              applied.humiliations.some(
                (row) => row.life === MP_HUMILIATION_TICKS,
              )
            ) {
              snakeAudio.playHumiliate();
            }
          }
          commitState(applied);
          if (applied.status === "playing") {
            predictLocalRef.current();
          }
          guestClockRef.current = performance.now();
          const summary = netStatsRef.current.flushIfDue(now);
          if (summary) {
            logNet("stats", { role: "guest", ...summary });
          }
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
                  : input.kind === "shed"
                    ? queueMpShed(current, input.playerId)
                    : queueMpInput(current, input.playerId, input.dir);
          stateRef.current = next;
          logNet("input", {
            from: input.playerId,
            kind: input.kind,
            dir: input.kind === "dir" ? input.dir : undefined,
          });
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
    lastHostTickRef.current = -1;
    guestClockRef.current = 0;
    lastSnapAtRef.current = 0;
    netStatsRef.current.reset();
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
        const delay = mpTickMs(current);
        while (now - guestClockRef.current >= delay) {
          guestClockRef.current += delay;
          predictLocal();
          break;
        }
        if (now - guestClockRef.current > delay * 4) {
          guestClockRef.current = now - delay;
        }
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isHost, predictLocal, state?.status]);

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
        if (
          next.humiliations.some((row) => row.life === MP_HUMILIATION_TICKS)
        ) {
          snakeAudio.playHumiliate();
        }
        if (isHostRef.current && !localReplayRef.current) {
          const dt =
            lastSnapAtRef.current > 0
              ? Math.round(now - lastSnapAtRef.current)
              : 0;
          lastSnapAtRef.current = now;
          logNet("tick", {
            role: "host",
            tick: next.tick,
            dt,
            status: next.status,
          });
          netStatsRef.current.recordSnap(dt, 0);
          publish(next);
          const summary = netStatsRef.current.flushIfDue(now);
          if (summary) {
            logNet("stats", { role: "host", ...summary });
          }
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
    logNet("input", {
      kind: "dir",
      dir: direction,
      host: isHostRef.current,
    });
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
    logNet("input", { kind: "fire", host: isHostRef.current });
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
    logNet("input", { kind: "turbo", host: isHostRef.current });
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
    logNet("input", { kind: "bomb", host: isHostRef.current });
    if (!isHostRef.current) {
      roomRef.current?.sendBomb();
    }
  }, []);

  const sendShed = useCallback(() => {
    void snakeAudio.unlock();
    const current = stateRef.current;
    if (!current) {
      return;
    }
    const next = queueMpShed(current, identityRef.current.playerId);
    if (next === current) {
      return;
    }
    stateRef.current = next;
    logNet("input", { kind: "shed", host: isHostRef.current });
    if (!isHostRef.current) {
      roomRef.current?.sendShed();
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
          corpses: frame.corpses,
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
    sendShed,
    toggleReady,
    setColor,
    replaySlowMo,
    getNetBps: () => roomRef.current?.throughput() ?? 0,
  };
}
