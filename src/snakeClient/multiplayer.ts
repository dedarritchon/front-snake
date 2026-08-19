import {REALTIME_SUBSCRIBE_STATES} from '@supabase/realtime-js';
import type {RealtimeChannel} from '@supabase/supabase-js';

import {isDirection} from '../game/engine';
import {
  MP_COLORS,
  MP_MAX_PLAYERS,
  type MpPlayer,
  type MpState,
} from '../game/multiplayerEngine';
import type {Direction} from '../game/types';
import {snakeSupabase} from './supabase';

export interface PresenceMeta {
  playerId: string;
  name: string;
  host: boolean;
  ready: boolean;
  joinedAt: number;
}

export interface RoomHandlers {
  onState: (state: MpState) => void;
  onRoster: (players: MpPlayer[], hostId: string | null) => void;
  onInput: (playerId: string, direction: Direction) => void;
  onStart: (seed: number) => void;
}

function parseMeta(value: unknown): PresenceMeta | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.playerId !== 'string' || typeof row.name !== 'string') {
    return null;
  }
  return {
    playerId: row.playerId,
    name: row.name,
    host: row.host === true,
    ready: row.ready === true,
    joinedAt: typeof row.joinedAt === 'number' ? row.joinedAt : 0,
  };
}

export function rosterFromPresence(
  state: Record<string, unknown[]>,
): MpPlayer[] {
  const metas: PresenceMeta[] = [];
  for (const presences of Object.values(state)) {
    const first = Array.isArray(presences) ? presences[0] : null;
    const meta = parseMeta(first);
    if (meta) {
      metas.push(meta);
    }
  }
  metas.sort((a, b) => a.joinedAt - b.joinedAt || a.playerId.localeCompare(b.playerId));
  return metas.slice(0, MP_MAX_PLAYERS).map((meta, index) => ({
    id: meta.playerId,
    name: meta.name,
    color: MP_COLORS[index] ?? MP_COLORS[0],
    host: meta.host,
    ready: meta.ready,
  }));
}

export class MultiplayerRoom {
  private channel: RealtimeChannel | null = null;
  private readonly roomId: string;
  private self: PresenceMeta;
  private readonly handlers: RoomHandlers;

  constructor(roomId: string, self: PresenceMeta, handlers: RoomHandlers) {
    this.roomId = roomId;
    this.self = self;
    this.handlers = handlers;
  }

  async connect(): Promise<void> {
    const supabase = snakeSupabase();
    const channel = supabase.channel(`snake-room:${this.roomId}`, {
      config: {
        presence: {key: this.self.playerId},
        broadcast: {self: false},
      },
    });

    channel
      .on('presence', {event: 'sync'}, () => {
        const players = rosterFromPresence(
          channel.presenceState(),
        );
        const host = players.find((player) => player.host);
        this.handlers.onRoster(players, host?.id ?? null);
      })
      .on('broadcast', {event: 'state'}, ({payload}) => {
        this.handlers.onState(payload as MpState);
      })
      .on('broadcast', {event: 'input'}, ({payload}) => {
        const body = payload as {playerId?: unknown; dir?: unknown};
        if (typeof body.playerId !== 'string' || !isDirection(body.dir)) {
          return;
        }
        this.handlers.onInput(body.playerId, body.dir);
      })
      .on('broadcast', {event: 'start'}, ({payload}) => {
        const seed = (payload as {seed?: unknown}).seed;
        if (typeof seed === 'number') {
          this.handlers.onStart(seed);
        }
      });

    const status = await new Promise<REALTIME_SUBSCRIBE_STATES>((resolve) => {
      channel.subscribe((next) => {
        if (
          next === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED ||
          next === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
          next === REALTIME_SUBSCRIBE_STATES.TIMED_OUT
        ) {
          resolve(next);
        }
      });
    });

    if (status !== REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
      throw new Error('Could not join room');
    }

    this.channel = channel;
    await channel.track(this.self);
  }

  async setReady(ready: boolean): Promise<void> {
    this.self = {...this.self, ready};
    await this.channel?.track(this.self);
  }

  sendInput(dir: Direction): void {
    void this.channel?.send({
      type: 'broadcast',
      event: 'input',
      payload: {playerId: this.self.playerId, dir},
    });
  }

  sendStart(seed: number): void {
    void this.channel?.send({
      type: 'broadcast',
      event: 'start',
      payload: {seed},
    });
  }

  sendState(state: MpState): void {
    void this.channel?.send({
      type: 'broadcast',
      event: 'state',
      payload: state,
    });
  }

  async disconnect(): Promise<void> {
    if (!this.channel) {
      return;
    }
    await snakeSupabase().removeChannel(this.channel);
    this.channel = null;
  }
}
