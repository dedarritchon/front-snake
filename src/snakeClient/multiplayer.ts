import {REALTIME_SUBSCRIBE_STATES} from '@supabase/realtime-js';
import type {RealtimeChannel} from '@supabase/supabase-js';

import {isDirection} from '../game/engine';
import {
  MP_COLORS,
  MP_MAX_PLAYERS,
  type MpPlayer,
  type MpState,
  toWireState,
} from '../game/multiplayerEngine';
import type {Direction} from '../game/types';
import {snakeSupabase} from './supabase';

export const PRESENCE_GRACE_MS = 4000;

export type RoomLink = 'connecting' | 'connected' | 'reconnecting';

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
  onLink: (link: RoomLink) => void;
  onResynced: () => void;
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

function colorRoster(players: MpPlayer[]): MpPlayer[] {
  return players
    .slice()
    .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
    .slice(0, MP_MAX_PLAYERS)
    .map((player, index) => ({
      ...player,
      color: MP_COLORS[index] ?? MP_COLORS[0],
    }));
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
  return colorRoster(
    metas.map((meta) => ({
      id: meta.playerId,
      name: meta.name,
      color: MP_COLORS[0],
      host: meta.host,
      ready: meta.ready,
      joinedAt: meta.joinedAt,
    })),
  );
}

export function holdRoster(
  previous: MpPlayer[],
  incoming: MpPlayer[],
  now: number,
  missingSince: Map<string, number>,
): {players: MpPlayer[]; missingSince: Map<string, number>} {
  const live = new Map(incoming.map((player) => [player.id, player]));
  const nextMissing = new Map<string, number>();
  const byId = new Map<string, MpPlayer>();

  for (const player of incoming) {
    byId.set(player.id, player);
  }

  for (const player of previous) {
    if (live.has(player.id)) {
      continue;
    }
    const since = missingSince.get(player.id) ?? now;
    if (now - since < PRESENCE_GRACE_MS) {
      nextMissing.set(player.id, since);
      byId.set(player.id, player);
    }
  }

  return {
    players: colorRoster([...byId.values()]),
    missingSince: nextMissing,
  };
}

const identities = new Map<string, {playerId: string; joinedAt: number}>();

export function roomIdentity(
  roomId: string,
  mintId: () => string,
): {playerId: string; joinedAt: number} {
  const existing = identities.get(roomId);
  if (existing) {
    return existing;
  }
  const created = {playerId: mintId(), joinedAt: Date.now()};
  identities.set(roomId, created);
  return created;
}

export class MultiplayerRoom {
  private channel: RealtimeChannel | null = null;
  private readonly roomId: string;
  private self: PresenceMeta;
  private readonly handlers: RoomHandlers;
  private closed = false;
  private retry = 0;
  private reconnectTimer: number | null = null;
  private previous: MpPlayer[] = [];
  private missingSince = new Map<string, number>();
  private generation = 0;
  private pendingState: MpState | null = null;
  private sendingState = false;

  constructor(roomId: string, self: PresenceMeta, handlers: RoomHandlers) {
    this.roomId = roomId;
    this.self = self;
    this.handlers = handlers;
  }

  async connect(): Promise<void> {
    this.closed = false;
    this.bindWindow();
    await this.openChannel();
  }

  async setReady(ready: boolean): Promise<void> {
    this.self = {...this.self, ready};
    await this.channel?.track(this.self);
  }

  async setHost(host: boolean): Promise<void> {
    this.self = {...this.self, host};
    await this.channel?.track(this.self);
  }

  async setName(name: string): Promise<void> {
    if (this.self.name === name) {
      return;
    }
    this.self = {...this.self, name};
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
    this.pendingState = toWireState(state);
    void this.flushState();
  }

  private async flushState(): Promise<void> {
    if (this.sendingState) {
      return;
    }
    this.sendingState = true;
    try {
      while (this.pendingState && this.channel && !this.closed) {
        const payload = this.pendingState;
        this.pendingState = null;
        await this.channel.send({
          type: 'broadcast',
          event: 'state',
          payload,
        });
      }
    } finally {
      this.sendingState = false;
      if (this.pendingState && this.channel && !this.closed) {
        void this.flushState();
      }
    }
  }

  async disconnect(): Promise<void> {
    this.closed = true;
    this.unbindWindow();
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    await this.tearChannel();
  }

  private readonly onVisible = (): void => {
    if (this.closed || document.visibilityState !== 'visible') {
      return;
    }
    if (this.channel) {
      void this.channel.track(this.self);
      return;
    }
    this.retry = 0;
    void this.openChannel();
  };

  private readonly onOnline = (): void => {
    if (this.closed) {
      return;
    }
    if (this.channel) {
      void this.channel.track(this.self);
      return;
    }
    this.retry = 0;
    this.handlers.onLink('reconnecting');
    void this.openChannel();
  };

  private bindWindow(): void {
    document.addEventListener('visibilitychange', this.onVisible);
    window.addEventListener('online', this.onOnline);
  }

  private unbindWindow(): void {
    document.removeEventListener('visibilitychange', this.onVisible);
    window.removeEventListener('online', this.onOnline);
  }

  private async tearChannel(): Promise<void> {
    const channel = this.channel;
    this.channel = null;
    this.pendingState = null;
    this.generation += 1;
    if (!channel) {
      return;
    }
    await snakeSupabase().removeChannel(channel);
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer !== null) {
      return;
    }
    this.handlers.onLink('reconnecting');
    const delay = Math.min(1000 * 2 ** this.retry, 8000);
    this.retry += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.openChannel();
    }, delay);
  }

  private emitRoster(channel: RealtimeChannel): void {
    const incoming = rosterFromPresence(channel.presenceState());
    if (!incoming.some((player) => player.id === this.self.playerId)) {
      incoming.push({
        id: this.self.playerId,
        name: this.self.name,
        color: MP_COLORS[0],
        host: this.self.host,
        ready: this.self.ready,
        joinedAt: this.self.joinedAt,
      });
    }
    const held = holdRoster(
      this.previous,
      incoming,
      Date.now(),
      this.missingSince,
    );
    this.previous = held.players;
    this.missingSince = held.missingSince;
    const host = held.players.find((player) => player.host);
    this.handlers.onRoster(held.players, host?.id ?? null);
  }

  private async openChannel(): Promise<void> {
    if (this.closed) {
      return;
    }
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    await this.tearChannel();
    const generation = this.generation;
    const supabase = snakeSupabase();
    const channel = supabase.channel(`snake-room:${this.roomId}`, {
      config: {
        presence: {key: this.self.playerId},
        broadcast: {self: false},
      },
    });

    channel
      .on('presence', {event: 'sync'}, () => {
        if (this.channel !== channel) {
          return;
        }
        this.emitRoster(channel);
      })
      .on('broadcast', {event: 'state'}, ({payload}) => {
        if (this.channel !== channel) {
          return;
        }
        this.handlers.onState(payload as MpState);
      })
      .on('broadcast', {event: 'input'}, ({payload}) => {
        if (this.channel !== channel) {
          return;
        }
        const body = payload as {playerId?: unknown; dir?: unknown};
        if (typeof body.playerId !== 'string' || !isDirection(body.dir)) {
          return;
        }
        this.handlers.onInput(body.playerId, body.dir);
      })
      .on('broadcast', {event: 'start'}, ({payload}) => {
        if (this.channel !== channel) {
          return;
        }
        const seed = (payload as {seed?: unknown}).seed;
        if (typeof seed === 'number') {
          this.handlers.onStart(seed);
        }
      });

    this.channel = channel;
    channel.subscribe((status) => {
      if (this.closed || this.generation !== generation) {
        return;
      }
      if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
        this.retry = 0;
        void channel.track(this.self).then(() => {
          if (this.closed || this.channel !== channel) {
            return;
          }
          this.handlers.onLink('connected');
          this.handlers.onResynced();
        });
        return;
      }
      this.scheduleReconnect();
    });
  }
}
