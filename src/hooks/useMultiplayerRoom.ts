import {useCallback, useEffect, useRef, useState} from 'react';

import {snakeAudio} from '../audio/snakeAudio';
import {isDirection, randomSeed} from '../game/engine';
import {
  createMpLobby,
  createPlayerId,
  killPlayer,
  markHostLeft,
  MP_TICK_MS,
  type MpPlayer,
  type MpState,
  queueMpInput,
  startMp,
  tickMp,
} from '../game/multiplayerEngine';
import type {Direction} from '../game/types';
import {MultiplayerRoom} from '../snakeClient/multiplayer';

export function useMultiplayerRoom(
  roomId: string,
  playerName: string,
  claimHost: boolean,
) {
  const playerIdRef = useRef(createPlayerId());
  const [state, setState] = useState<MpState | null>(null);
  const [players, setPlayers] = useState<MpPlayer[]>([]);
  const [isHost, setIsHost] = useState(claimHost);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const stateRef = useRef(state);
  const isHostRef = useRef(isHost);
  const playersRef = useRef(players);
  const roomRef = useRef<MultiplayerRoom | null>(null);
  stateRef.current = state;
  isHostRef.current = isHost;
  playersRef.current = players;

  const publish = useCallback((next: MpState) => {
    stateRef.current = next;
    setState(next);
    roomRef.current?.sendState(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const room = new MultiplayerRoom(
      roomId,
      {
        playerId: playerIdRef.current,
        name: playerName,
        host: claimHost,
        joinedAt: Date.now(),
      },
      {
        onRoster: (nextPlayers, hostId) => {
          if (cancelled) {
            return;
          }
          setPlayers(nextPlayers);
          playersRef.current = nextPlayers;
          const nowHost =
            hostId === playerIdRef.current ||
            (!hostId && nextPlayers[0]?.id === playerIdRef.current);
          isHostRef.current = nowHost;
          setIsHost(nowHost);

          const current = stateRef.current;
          if (nowHost) {
            if (!current || current.status === 'lobby') {
              publish(
                createMpLobby(nextPlayers, current?.seed ?? randomSeed()),
              );
              return;
            }
            if (current.status === 'playing') {
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
                publish(next);
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
          }
        },
      },
    );
    roomRef.current = room;
    void room
      .connect()
      .then(() => {
        if (!cancelled) {
          setConnected(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not join room');
        }
      });

    return () => {
      cancelled = true;
      roomRef.current = null;
      void room.disconnect();
    };
  }, [claimHost, playerName, publish, roomId]);

  useEffect(() => {
    if (!isHost || state?.status !== 'playing') {
      return;
    }
    const id = window.setInterval(() => {
      const current = stateRef.current;
      if (current?.status !== 'playing') {
        return;
      }
      const next = tickMp(current);
      if (next.snakes.some((snake, index) => snake.score > current.snakes[index].score)) {
        snakeAudio.playEat();
      }
      if (next.snakes.some((snake, index) => current.snakes[index].alive && !snake.alive)) {
        snakeAudio.playDie();
      }
      publish(next);
    }, MP_TICK_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [isHost, publish, state?.status]);

  useEffect(() => {
    if (state?.status === 'playing') {
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
      const next = queueMpInput(current, playerIdRef.current, direction);
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
    snakeAudio.playMove(direction);
    roomRef.current?.sendInput(direction);
  }, []);

  const startMatch = useCallback(() => {
    if (!isHostRef.current || playersRef.current.length < 2) {
      return;
    }
    const seed = randomSeed();
    const current =
      stateRef.current ?? createMpLobby(playersRef.current, seed);
    snakeAudio.playStart();
    roomRef.current?.sendStart(seed);
    publish(startMp(current, seed));
  }, [publish]);

  return {
    playerId: playerIdRef.current,
    state,
    players,
    isHost,
    error,
    connected,
    sendDirection,
    startMatch,
  };
}
