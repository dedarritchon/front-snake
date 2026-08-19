import {useCallback, useEffect, useRef, useState} from 'react';

import {snakeAudio} from '../audio/snakeAudio';
import {isDirection, randomSeed} from '../game/engine';
import {
  advanceReplay,
  allReadyToStart,
  beginReplay,
  createMpLobby,
  createPlayerId,
  killPlayer,
  markHostLeft,
  MP_REPLAY_FRAMES,
  MP_REPLAY_TICK_MS,
  MP_TICK_MS,
  type MpPlayer,
  type MpSnapshot,
  type MpState,
  queueMpInput,
  shouldSlowMo,
  snapshotMp,
  startMp,
  tickMp,
} from '../game/multiplayerEngine';
import type {Direction} from '../game/types';
import {
  MultiplayerRoom,
  roomIdentity,
  type RoomLink,
} from '../snakeClient/multiplayer';

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
  const [link, setLink] = useState<RoomLink>('connecting');

  const stateRef = useRef(state);
  const isHostRef = useRef(isHost);
  const playersRef = useRef(players);
  const readyRef = useRef(ready);
  const roomRef = useRef<MultiplayerRoom | null>(null);
  const nameRef = useRef(playerName);
  nameRef.current = playerName;
  stateRef.current = state;
  isHostRef.current = isHost;
  playersRef.current = players;
  readyRef.current = ready;

  const publish = useCallback((next: MpState) => {
    stateRef.current = next;
    setState(next);
    roomRef.current?.sendState(next);
  }, []);
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
    snakeAudio.playStart();
    roomRef.current?.sendStart(seed);
    historyRef.current = [];
    publish(startMp(createMpLobby(playersRef.current, seed), seed));
    clearReady();
  }, [clearReady, publish]);
  const beginMatchRef = useRef(beginMatch);
  beginMatchRef.current = beginMatch;
  const historyRef = useRef<MpSnapshot[]>([]);

  useEffect(() => {
    let cancelled = false;
    const identity = identityRef.current;
    const room = new MultiplayerRoom(
      roomId,
      {
        playerId: identity.playerId,
        name: nameRef.current,
        host: claimHost,
        ready: false,
        joinedAt: identity.joinedAt,
      },
      {
        onLink: (next) => {
          if (!cancelled) {
            setLink(next);
            if (next === 'connected') {
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
            room.sendState(current);
          }
        },
        onRoster: (nextPlayers, hostId) => {
          if (cancelled) {
            return;
          }
          setPlayers(nextPlayers);
          playersRef.current = nextPlayers;
          const current = stateRef.current;
          const playing = current?.status === 'playing';
          const nowHost =
            hostId === identity.playerId ||
            (!hostId &&
              !playing &&
              current?.status !== 'over' &&
              nextPlayers[0]?.id === identity.playerId);
          if (nowHost && !isHostRef.current) {
            void room.setHost(true);
          }
          isHostRef.current = nowHost;
          setIsHost(nowHost);

          if (nowHost) {
            if (!current || current.status === 'lobby') {
              publishRef.current(
                createMpLobby(nextPlayers, current?.seed ?? randomSeed()),
              );
            } else if (current.status === 'playing') {
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
              if (!latest || latest.status === 'lobby' || latest.status === 'over') {
                beginMatchRef.current();
              }
            }
            return;
          }

          if (
            !hostId &&
            current &&
            (current.status === 'playing' || current.status === 'lobby')
          ) {
            const left = markHostLeft(current);
            stateRef.current = left;
            setState(left);
          }
        },
        onState: (next) => {
          if (cancelled || isHostRef.current) {
            return;
          }
          stateRef.current = next;
          setState(next);
          if (next.status === 'playing') {
            clearReadyRef.current();
          }
        },
        onInput: (id, direction) => {
          if (!isHostRef.current) {
            return;
          }
          const current = stateRef.current;
          if (!current) {
            return;
          }
          const next = queueMpInput(current, id, direction);
          stateRef.current = next;
          setState(next);
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
        setError('Could not join room');
      }
    });

    return () => {
      cancelled = true;
      roomRef.current = null;
      void room.disconnect();
    };
  }, [claimHost, roomId]);

  useEffect(() => {
    void roomRef.current?.setName(playerName);
  }, [playerName]);

  useEffect(() => {
    historyRef.current = [];
  }, [roomId]);

  useEffect(() => {
    if (!isHost || (state?.status !== 'playing' && state?.status !== 'replay')) {
      return;
    }
    const delay = state.status === 'replay' ? MP_REPLAY_TICK_MS : MP_TICK_MS;
    const id = window.setInterval(() => {
      const current = stateRef.current;
      if (!current) {
        return;
      }
      if (current.status === 'replay') {
        publish(advanceReplay(current));
        return;
      }
      if (current.status !== 'playing') {
        return;
      }
      const next = tickMp(current);
      historyRef.current = [
        ...historyRef.current.slice(-(MP_REPLAY_FRAMES - 1)),
        snapshotMp(current),
      ];
      if (next.snakes.some((snake, index) => snake.score > current.snakes[index].score)) {
        snakeAudio.playEat();
      }
      if (next.snakes.some((snake, index) => current.snakes[index].alive && !snake.alive)) {
        snakeAudio.playDie();
      }
      if (shouldSlowMo(current, next)) {
        publish(
          beginReplay(next, [...historyRef.current, snapshotMp(next)]),
        );
        return;
      }
      publish(next);
    }, delay);
    return () => {
      window.clearInterval(id);
    };
  }, [isHost, publish, state?.status]);

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
    if (isHostRef.current) {
      const current = stateRef.current;
      if (!current) {
        return;
      }
      const next = queueMpInput(current, identityRef.current.playerId, direction);
      const changed = next.snakes.some(
        (snake, index) => snake.pending !== current.snakes[index].pending,
      );
      if (changed) {
        snakeAudio.playMove(direction);
      }
      stateRef.current = next;
      setState(next);
      return;
    }
    if (stateRef.current?.status !== 'playing') {
      return;
    }
    snakeAudio.playMove(direction);
    roomRef.current?.sendInput(direction);
  }, []);

  const toggleReady = useCallback(() => {
    const status = stateRef.current?.status ?? 'lobby';
    if (status === 'playing' || status === 'replay') {
      return;
    }
    const next = !readyRef.current;
    readyRef.current = next;
    setReady(next);
    void roomRef.current?.setReady(next);
  }, []);

  return {
    playerId: identityRef.current.playerId,
    state,
    players,
    isHost,
    ready,
    error,
    link,
    connected: link === 'connected',
    sendDirection,
    toggleReady,
  };
}
