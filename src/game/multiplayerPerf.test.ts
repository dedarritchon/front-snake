import { describe, expect, it } from "vitest";

import { payloadBytes, wireBitsPerSec } from "../snakeClient/throughput";
import {
  acceptHostTick,
  advanceLocalSnake,
  applyHostSnapshot,
  beginReplay,
  createMpLobby,
  fromWireState,
  MP_GRID_WIDTH,
  MP_TICK_MS,
  type MpPlayer,
  type MpState,
  queueMpFire,
  queueMpInput,
  shouldCoverLateHost,
  snapshotMp,
  startMp,
  tickMp,
  toWireState,
} from "./multiplayerEngine";

const FOUR: MpPlayer[] = [
  { id: "a", name: "A", color: "#111", host: true, ready: true, joinedAt: 1 },
  { id: "b", name: "B", color: "#222", host: false, ready: true, joinedAt: 2 },
  { id: "c", name: "C", color: "#333", host: false, ready: true, joinedAt: 3 },
  { id: "d", name: "D", color: "#444", host: false, ready: true, joinedAt: 4 },
];

const WIRE_BYTE_CAP = 4096;
const WIRE_BITS_CAP = 400_000;
const TICK_STEPS = 2000;
const TICK_MS_CAP = 500;

function lateGame(state: MpState): MpState {
  return {
    ...state,
    foods: [
      { x: 8, y: 8 },
      { x: 9, y: 12 },
      { x: 14, y: 6 },
    ],
    shots: [
      { ownerId: "a", x: 10, y: 10, direction: "right" },
      { ownerId: "b", x: 12, y: 8, direction: "left" },
    ],
    bombs: [{ ownerId: "c", x: 5, y: 5, fuse: 10 }],
    blasts: [{ x: 6, y: 6, life: 2 }],
    snakes: state.snakes.map((snake) => ({
      ...snake,
      body: Array.from({ length: 20 }, (_, cell) => ({
        x: (snake.body[0].x + cell) % MP_GRID_WIDTH,
        y: snake.body[0].y,
      })),
    })),
  };
}

function guestApply(
  lastTick: number,
  local: MpState | null,
  incoming: MpState,
  playerId: string,
): { lastTick: number; local: MpState | null } {
  if (!acceptHostTick(lastTick, incoming, local?.status)) {
    return { lastTick, local };
  }
  return {
    lastTick: incoming.tick,
    local: applyHostSnapshot(incoming, local, playerId),
  };
}

describe("multiplayer performance", () => {
  it("keeps a 4-player late-game snapshot under the wire budget", () => {
    const state = lateGame(startMp(createMpLobby(FOUR, 7)));
    const bytes = payloadBytes(toWireState(state));
    expect(bytes).toBeLessThan(WIRE_BYTE_CAP);
    expect(wireBitsPerSec(bytes, MP_TICK_MS)).toBeLessThan(WIRE_BITS_CAP);
  });

  it("omits in-flight replay frames from the live wire payload", () => {
    const playing = startMp(createMpLobby(FOUR, 1));
    const frame = snapshotMp(playing);
    const replay = beginReplay({ ...playing, status: "over", lastDeaths: [] }, [
      frame,
      frame,
    ]);
    expect(toWireState(replay).replay).toBeUndefined();
    expect(toWireState(playing).replay).toBeUndefined();
  });

  it("packs shots and still round-trips", () => {
    const state = lateGame(startMp(createMpLobby(FOUR, 3)));
    const wire = toWireState(state);
    expect(wire.shots).toEqual({
      o: ["a", "b"],
      p: [10, 10, 1, 12, 8, 3],
    });
    expect(fromWireState(wire)?.shots).toEqual(state.shots);
    expect(fromWireState({ ...wire, shots: state.shots })?.shots).toEqual(
      state.shots,
    );
    expect(wire.bombs).toEqual({
      o: ["c"],
      p: [5, 5, 10],
    });
    expect(fromWireState(wire)?.bombs).toEqual(state.bombs);
    expect(fromWireState({ ...wire, bombs: state.bombs })?.bombs).toEqual(
      state.bombs,
    );
  });

  it("drops a stale host tick and keeps a newer local turn", () => {
    const host = startMp(createMpLobby(FOUR, 1));
    const guessed = tickMp(host);
    expect(guessed.tick).toBe(host.tick + 1);
    expect(acceptHostTick(guessed.tick, host, guessed.status)).toBe(false);

    const next = { ...host, tick: host.tick + 1 };
    expect(acceptHostTick(host.tick, next, host.status)).toBe(true);
    const local = queueMpInput(host, "b", "down");
    const applied = applyHostSnapshot(next, local, "b");
    expect(applied.snakes[1].pending).toBe("down");
  });

  it("does not advance remote snakes between host snapshots of the same tick", () => {
    const host = startMp(createMpLobby(FOUR, 1));
    const guessed = tickMp(host);
    let session = guestApply(-1, null, host, "b");
    const remote = host.snakes[0].body;
    session = guestApply(session.lastTick, session.local, host, "b");
    expect(session.local?.tick).toBe(host.tick);
    expect(session.local?.snakes[0].body).toEqual(remote);
    expect(session.local?.snakes[0].body).not.toEqual(guessed.snakes[0].body);

    const applied = applyHostSnapshot(host, guessed, "b");
    expect(applied.tick).toBe(host.tick);
    expect(applied.snakes[0].body).toEqual(host.snakes[0].body);
  });

  it("advances only the local snake when the host is late", () => {
    const host = startMp(createMpLobby(FOUR, 1));
    const local = queueMpInput(host, "b", "down");
    const predicted = advanceLocalSnake(local, "b");
    expect(predicted).not.toBe(local);
    expect(predicted.tick).toBe(host.tick + 1);
    expect(predicted.snakes[0].body).toEqual(host.snakes[0].body);
    expect(predicted.snakes[1].body[0]).toEqual({
      x: local.snakes[1].body[0].x,
      y: local.snakes[1].body[0].y + 1,
    });
    expect(predicted.foods).toBe(local.foods);
    expect(shouldCoverLateHost(true, 300, 100, MP_TICK_MS)).toBe(false);
    expect(shouldCoverLateHost(false, 300, 100, MP_TICK_MS)).toBe(true);
    expect(shouldCoverLateHost(false, 200, 0, MP_TICK_MS)).toBe(false);

    const incoming = { ...host, tick: host.tick + 1 };
    expect(acceptHostTick(host.tick, incoming, host.status)).toBe(true);
    const applied = applyHostSnapshot(incoming, predicted, "b");
    expect(applied.snakes[0].body).toEqual(host.snakes[0].body);
    expect(applied.snakes[1].pending).toBe("down");
  });

  it("wraps a turbo local step and stops at a wall", () => {
    const playing = startMp(createMpLobby(FOUR, 1));
    const wrapped = advanceLocalSnake(
      {
        ...playing,
        snakes: playing.snakes.map((snake) =>
          snake.id === "b"
            ? {
                ...snake,
                turboLeft: 2,
                direction: "left" as const,
                pending: "left" as const,
                body: [
                  { x: 0, y: 3 },
                  { x: 1, y: 3 },
                  { x: 2, y: 3 },
                ],
              }
            : snake,
        ),
      },
      "b",
    );
    expect(wrapped.snakes[1].body[0]).toEqual({
      x: MP_GRID_WIDTH - 1,
      y: 3,
    });
    const blocked = {
      ...playing,
      snakes: playing.snakes.map((snake) =>
        snake.id === "b"
          ? {
              ...snake,
              direction: "left" as const,
              pending: "left" as const,
              turboLeft: 0,
              body: [
                { x: 0, y: 3 },
                { x: 1, y: 3 },
                { x: 2, y: 3 },
              ],
            }
          : snake,
      ),
    };
    expect(advanceLocalSnake(blocked, "b")).toBe(blocked);
  });

  it("returns the same state when input does not change", () => {
    const playing = startMp(createMpLobby(FOUR, 1));
    const turned = queueMpInput(playing, "b", "down");
    expect(queueMpInput(turned, "b", "down")).toBe(turned);
    expect(queueMpFire(playing, "b")).toBe(playing);
  });

  it("ticks a crowded board without a CPU blow-up", () => {
    let state: MpState = lateGame(startMp(createMpLobby(FOUR, 11)));
    const started = performance.now();
    for (let i = 0; i < TICK_STEPS; i += 1) {
      state = tickMp(state);
    }
    expect(performance.now() - started).toBeLessThan(TICK_MS_CAP);
  });
});
