import { describe, expect, it } from "vitest";

import { BASE_TICK_MS, SCORE_PER_FOOD as SOLO_SCORE } from "./engine";
import type { MpPlayer, MpState } from "./multiplayerEngine";
import {
  advanceCountdown,
  advanceReplay,
  allReadyToStart,
  beginReplay,
  beginRound,
  createMpLobby,
  createPackedSnapshotRing,
  createPlayerId,
  createRoomId,
  describeDeaths,
  fromWireState,
  isRoomId,
  keepLocalIntent,
  killPlayer,
  markHostLeft,
  MP_BOMB_FUSE_TICKS,
  MP_COUNTDOWN_START,
  MP_FIRE_COOLDOWN,
  MP_GRID_HEIGHT,
  MP_GRID_WIDTH,
  MP_MAX_PLAYERS,
  MP_POWER_COST,
  MP_REPLAY_FRAMES,
  MP_ROUNDS,
  MP_TICK_MS,
  MP_TURBO_TICKS,
  MP_WIN_LENGTH,
  mpRound,
  mpTickMs,
  normalizeRoomId,
  queueMpBomb,
  queueMpFire,
  queueMpInput,
  queueMpTurbo,
  retainReplay,
  roundStandings,
  shouldPersonalSlowMo,
  shouldSlowMo,
  snapshotMp,
  startMp,
  tickMp,
  toWireState,
} from "./multiplayerEngine";

const PLAYERS: MpPlayer[] = [
  { id: "a", name: "A", color: "#111", host: true, ready: false, joinedAt: 1 },
  { id: "b", name: "B", color: "#222", host: false, ready: false, joinedAt: 2 },
  { id: "c", name: "C", color: "#333", host: false, ready: false, joinedAt: 3 },
];

describe("multiplayerEngine", () => {
  it("refuses to start with one player", () => {
    const lobby = createMpLobby([PLAYERS[0]], 1);
    expect(startMp(lobby).status).toBe("lobby");
  });

  it("caps the lobby at four snakes", () => {
    const extra: MpPlayer[] = [
      ...PLAYERS,
      {
        id: "d",
        name: "D",
        color: "#444",
        host: false,
        ready: false,
        joinedAt: 4,
      },
      {
        id: "e",
        name: "E",
        color: "#555",
        host: false,
        ready: false,
        joinedAt: 5,
      },
    ];
    expect(createMpLobby(extra, 1).snakes).toHaveLength(MP_MAX_PLAYERS);
  });

  it("copies claimed colors onto snakes", () => {
    const lobby = createMpLobby(PLAYERS.slice(0, 2), 1);
    expect(lobby.snakes.map((snake) => snake.color)).toEqual(["#111", "#222"]);
  });

  it("starts two snakes in opposite corners", () => {
    const playing = startMp(createMpLobby(PLAYERS.slice(0, 2), 9));
    expect(playing.status).toBe("playing");
    expect(playing.snakes).toHaveLength(2);
    expect(playing.foods.length).toBeGreaterThan(0);
    expect(playing.gridWidth).toBe(MP_GRID_WIDTH);
    expect(playing.gridHeight).toBe(MP_GRID_HEIGHT);
    expect(playing.snakes[0].body[0]).toEqual({ x: 2, y: 3 });
    expect(playing.snakes[1].body[0]).toEqual({ x: MP_GRID_WIDTH - 3, y: 3 });
  });

  it("ignores a reverse input and lobby input", () => {
    const lobby = createMpLobby(PLAYERS.slice(0, 2), 3);
    expect(queueMpInput(lobby, "a", "down").snakes[0].pending).toBe("right");
    let state = startMp(lobby);
    state = queueMpInput(state, "a", "left");
    expect(state.snakes[0].pending).toBe("right");
    state = queueMpInput(state, "a", "down");
    expect(state.snakes[0].pending).toBe("down");
  });

  it("does not tick in the lobby", () => {
    const lobby = createMpLobby(PLAYERS.slice(0, 2), 1);
    expect(tickMp(lobby)).toBe(lobby);
  });

  it("grows a snake that eats", () => {
    let state = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    const head = state.snakes[0].body[0];
    const bait = { x: head.x + 1, y: head.y };
    state = {
      ...state,
      foods: [bait],
      snakes: [
        { ...state.snakes[0], direction: "right", pending: "right" },
        state.snakes[1],
      ],
    };
    const length = state.snakes[0].body.length;
    state = tickMp(state);
    expect(state.snakes[0].score).toBe(SOLO_SCORE);
    expect(state.snakes[0].body).toHaveLength(length + 1);
    expect(state.status).toBe("playing");
  });

  it("kills a snake that hits a wall and continues if others remain", () => {
    let state = startMp(createMpLobby(PLAYERS, 1));
    state = {
      ...state,
      foods: [{ x: 9, y: 18 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "left",
          pending: "left",
          body: [
            { x: 0, y: 10 },
            { x: 1, y: 10 },
            { x: 2, y: 10 },
          ],
        },
        state.snakes[1],
        state.snakes[2],
      ],
    };
    state = tickMp(state);
    expect(state.snakes[0].alive).toBe(false);
    expect(state.status).toBe("playing");
    expect(state.snakes.filter((snake) => snake.alive)).toHaveLength(2);
  });

  it("kills a snake that runs into another body", () => {
    let state = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          body: [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 },
          ],
        },
        {
          ...state.snakes[1],
          direction: "right",
          pending: "right",
          body: [
            { x: 7, y: 10 },
            { x: 6, y: 10 },
            { x: 5, y: 10 },
          ],
        },
      ],
    };
    state = tickMp(state);
    expect(state.status).toBe("countdown");
    expect(state.matchRound).toBe(2);
    expect(state.roundWinnerId).toBe("b");
    expect(state.snakes.find((snake) => snake.id === "b")?.roundWins).toBe(1);
  });

  it("declares a draw when the last two heads share a cell", () => {
    let state = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          body: [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 },
          ],
        },
        {
          ...state.snakes[1],
          direction: "left",
          pending: "left",
          body: [
            { x: 7, y: 10 },
            { x: 8, y: 10 },
            { x: 9, y: 10 },
          ],
        },
      ],
    };
    state = tickMp(state);
    expect(state.status).toBe("countdown");
    expect(state.matchRound).toBe(2);
    expect(state.winnerId).toBeNull();
    expect(state.roundWinnerId).toBeNull();
    expect(state.snakes.every((snake) => snake.roundWins === 0)).toBe(true);
  });

  it("awards the last living snake", () => {
    let state = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    state = killPlayer(state, "b");
    expect(state.status).toBe("over");
    expect(state.winnerId).toBe("a");
    expect(state.snakes.find((snake) => snake.id === "a")?.roundWins).toBe(1);
  });

  it("drops a player from the lobby and ends the match if the host leaves", () => {
    const lobby = createMpLobby(PLAYERS.slice(0, 2), 1);
    expect(killPlayer(lobby, "b").snakes.map((snake) => snake.id)).toEqual([
      "a",
    ]);
    const left = markHostLeft(startMp(lobby));
    expect(left.status).toBe("over");
    expect(left.hostLeft).toBe(true);
  });

  it("mints room and player ids", () => {
    expect(createRoomId()).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
    expect(createPlayerId()).toMatch(/^[0-9a-f]{12}$/);
  });

  it("normalizes pasted room ids", () => {
    expect(normalizeRoomId("  AB-CD 23 ")).toBe("abcd23");
    expect(isRoomId("abcd")).toBe(true);
    expect(isRoomId("abc")).toBe(false);
  });

  it("starts only when every seated player is ready", () => {
    expect(allReadyToStart(PLAYERS)).toBe(false);
    expect(
      allReadyToStart(PLAYERS.map((player) => ({ ...player, ready: true }))),
    ).toBe(true);
    expect(allReadyToStart([{ ...PLAYERS[0], ready: true }])).toBe(false);
  });

  it("spawns food only on the versus grid", () => {
    let state = startMp(createMpLobby(PLAYERS.slice(0, 2), 44));
    for (let i = 0; i < 12; i += 1) {
      state = tickMp(state);
    }
    for (const food of state.foods) {
      expect(food.x).toBeGreaterThanOrEqual(0);
      expect(food.x).toBeLessThan(MP_GRID_WIDTH);
      expect(food.y).toBeGreaterThanOrEqual(0);
      expect(food.y).toBeLessThan(MP_GRID_HEIGHT);
    }
  });

  it("does not treat the solo board edge as a versus wall", () => {
    let state = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          body: [
            { x: 19, y: 10 },
            { x: 18, y: 10 },
            { x: 17, y: 10 },
          ],
        },
        state.snakes[1],
      ],
    };
    state = tickMp(state);
    expect(state.snakes[0].alive).toBe(true);
    expect(state.snakes[0].body[0]).toEqual({ x: 20, y: 10 });
  });

  it("kills a snake on the versus right wall", () => {
    let state = startMp(createMpLobby(PLAYERS, 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          body: [
            { x: MP_GRID_WIDTH - 1, y: 10 },
            { x: MP_GRID_WIDTH - 2, y: 10 },
            { x: MP_GRID_WIDTH - 3, y: 10 },
          ],
        },
        state.snakes[1],
        state.snakes[2],
      ],
    };
    state = tickMp(state);
    expect(state.snakes[0].alive).toBe(false);
    expect(state.status).toBe("playing");
  });

  it("does not move a dead snake", () => {
    let state = startMp(createMpLobby(PLAYERS, 1));
    const body = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
    ];
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          alive: false,
          direction: "right",
          pending: "right",
          body,
        },
        state.snakes[1],
        state.snakes[2],
      ],
    };
    state = tickMp(state);
    expect(state.snakes[0].body).toEqual(body);
    expect(state.status).toBe("playing");
  });

  it("ignores input for an unknown or dead snake", () => {
    let state = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    expect(queueMpInput(state, "nope", "down").snakes[0].pending).toBe(
      state.snakes[0].pending,
    );
    state = killPlayer(state, "a");
    expect(queueMpInput(state, "a", "down").snakes[0].pending).toBe(
      state.snakes[0].pending,
    );
  });

  it("keeps the match going when one of three snakes leaves", () => {
    const playing = startMp(createMpLobby(PLAYERS, 1));
    const next = killPlayer(playing, "c");
    expect(next.status).toBe("playing");
    expect(next.snakes.find((snake) => snake.id === "c")?.alive).toBe(false);
  });

  it("resets scores and bodies on rematch", () => {
    let state = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    state = {
      ...state,
      status: "over",
      snakes: state.snakes.map((snake) => ({
        ...snake,
        score: 40,
        roundWins: 3,
        alive: false,
      })),
    };
    const rematch = startMp(state, 2);
    expect(rematch.status).toBe("playing");
    expect(
      rematch.snakes.every((snake) => snake.alive && snake.score === 0),
    ).toBe(true);
    expect(rematch.snakes.every((snake) => snake.roundWins === 0)).toBe(true);
    expect(rematch.snakes.every((snake) => snake.power === 0)).toBe(true);
    expect(rematch.shots).toEqual([]);
    expect(rematch.snakes[0].body[0]).toEqual({ x: 2, y: 3 });
  });

  it("ends a lobby when the host leaves", () => {
    const lobby = markHostLeft(createMpLobby(PLAYERS.slice(0, 2), 1));
    expect(lobby.status).toBe("over");
    expect(lobby.hostLeft).toBe(true);
    expect(tickMp(lobby)).toBe(lobby);
  });

  it("rejects ambiguous room-id glyphs", () => {
    expect(isRoomId("abcd1")).toBe(false);
    expect(isRoomId("abcdl")).toBe(false);
    expect(isRoomId("abcdo")).toBe(false);
    expect(normalizeRoomId("Ab-23")).toBe("ab23");
    expect(isRoomId(createRoomId())).toBe(true);
  });

  it("keeps a dead body on the board when others remain", () => {
    let state = startMp(createMpLobby(PLAYERS, 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "left",
          pending: "left",
          body: [
            { x: 0, y: 10 },
            { x: 1, y: 10 },
            { x: 2, y: 10 },
          ],
        },
        state.snakes[1],
        state.snakes[2],
      ],
    };
    const next = tickMp(state);
    expect(next.status).toBe("playing");
    expect(next.snakes[0].alive).toBe(false);
    expect(next.snakes[0].body).toHaveLength(3);
    expect(next.lastDeaths[0]).toMatchObject({ playerId: "a", cause: "wall" });
    expect(shouldSlowMo(state, next)).toBe(false);
    expect(shouldPersonalSlowMo(state, next, "a")).toBe(true);
    expect(shouldPersonalSlowMo(state, next, "b")).toBe(false);
    expect(describeDeaths(next.lastDeaths, next.snakes)).toBe("A hit the wall");
  });

  it("names a crash between the last two snakes", () => {
    let state = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          body: [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 },
          ],
        },
        {
          ...state.snakes[1],
          direction: "left",
          pending: "left",
          body: [
            { x: 7, y: 10 },
            { x: 8, y: 10 },
            { x: 9, y: 10 },
          ],
        },
      ],
    };
    const next = tickMp(state);
    expect(next.status).toBe("countdown");
    expect(next.roundWinnerId).toBeNull();
    expect(next.lastDeaths.every((death) => death.cause === "head")).toBe(true);
    expect(shouldSlowMo(state, next)).toBe(false);
    expect(shouldPersonalSlowMo(state, next, "a")).toBe(false);
    expect(describeDeaths(next.lastDeaths, next.snakes)).toBe(
      "A and B crashed",
    );
  });

  it("slow-mos when two of three crash and the third wins", () => {
    let state = startMp(createMpLobby(PLAYERS, 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          body: [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 },
          ],
        },
        {
          ...state.snakes[1],
          direction: "left",
          pending: "left",
          body: [
            { x: 7, y: 10 },
            { x: 8, y: 10 },
            { x: 9, y: 10 },
          ],
        },
        {
          ...state.snakes[2],
          direction: "right",
          pending: "right",
          body: [
            { x: 2, y: 20 },
            { x: 1, y: 20 },
            { x: 0, y: 20 },
          ],
        },
      ],
    };
    const next = tickMp(state);
    expect(next.status).toBe("countdown");
    expect(next.matchRound).toBe(2);
    expect(next.roundWinnerId).toBe("c");
    expect(next.snakes.find((snake) => snake.id === "c")?.roundWins).toBe(1);
    expect(shouldSlowMo(state, next)).toBe(false);
  });

  it("replays frames then returns to over", () => {
    const over = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    const first = snapshotMp(over);
    const second = snapshotMp({
      ...over,
      snakes: over.snakes.map((snake) => ({ ...snake, alive: false })),
    });
    let replay = beginReplay({ ...over, status: "over", lastDeaths: [] }, [
      first,
      second,
    ]);
    expect(replay.status).toBe("replay");
    expect(replay.snakes[0].alive).toBe(true);
    replay = advanceReplay(replay);
    expect(replay.snakes[0].alive).toBe(false);
    replay = advanceReplay(replay);
    expect(replay.status).toBe("over");
    expect(replay.replay).toHaveLength(2);
    const again = beginReplay(replay, replay.replay);
    expect(again.status).toBe("replay");
    expect(again.snakes[0].alive).toBe(true);
  });

  it("strips in-flight replay frames from the wire payload", () => {
    const playing = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    const frame = snapshotMp(playing);
    const replay = beginReplay({ ...playing, status: "over", lastDeaths: [] }, [
      frame,
      frame,
    ]);
    expect(replay.replay).toHaveLength(2);
    expect(toWireState(replay).replay).toBeUndefined();
    expect(fromWireState(toWireState(playing))).toEqual(playing);
    let over = advanceReplay(replay);
    over = advanceReplay(over);
    expect(over.status).toBe("over");
    expect(fromWireState(toWireState(over))?.replay).toHaveLength(2);
    expect(toWireState(over, { includeReplay: false }).replay).toBeUndefined();
    const omitted = fromWireState(toWireState(over, { includeReplay: false }));
    expect(omitted?.replay).toEqual([]);
    if (omitted) {
      expect(retainReplay(omitted, over).replay).toHaveLength(2);
    }
  });

  it("keeps a packed history ring of the last replay frames", () => {
    const playing = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    const ring = createPackedSnapshotRing();
    for (let i = 0; i < MP_REPLAY_FRAMES + 3; i += 1) {
      ring.push({ ...playing, tick: i });
    }
    const frames = ring.unpack();
    expect(frames).toHaveLength(MP_REPLAY_FRAMES);
    expect(frames[0].snakes[0].body).toEqual(playing.snakes[0].body);
    ring.clear();
    expect(ring.unpack()).toEqual([]);
  });

  it("packs bodies so live ticks send less than a full snapshot", () => {
    const playing = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    const long: MpState = {
      ...playing,
      snakes: playing.snakes.map((snake, index) =>
        index === 0
          ? {
              ...snake,
              body: Array.from({ length: 24 }, (_, cell) => ({
                x: cell,
                y: 3,
              })),
            }
          : snake,
      ),
    };
    expect(JSON.stringify(toWireState(long)).length).toBeLessThan(
      JSON.stringify(long).length,
    );
  });

  it("rejects a malformed wire payload", () => {
    expect(fromWireState(null)).toBeNull();
    expect(fromWireState({ tick: 1 })).toBeNull();
  });

  it("keeps versus on the solo base clock except during slow-mo", () => {
    const start = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    expect(mpTickMs(start)).toBe(BASE_TICK_MS);
    expect(MP_TICK_MS).toBe(BASE_TICK_MS);
    const grown: MpState = {
      ...start,
      snakes: start.snakes.map((snake, index) =>
        index === 0
          ? {
              ...snake,
              score: 25,
              body: Array.from({ length: 12 }, (_, cell) => ({
                x: cell,
                y: 0,
              })),
            }
          : snake,
      ),
    };
    expect(mpTickMs(grown)).toBe(MP_TICK_MS);
    expect(mpTickMs({ ...start, status: "replay" })).toBe(420);
  });

  it("keeps a guest turn that the host snapshot has not applied yet", () => {
    const playing = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    const charged = {
      ...playing,
      snakes: playing.snakes.map((snake) =>
        snake.id === "b" ? { ...snake, power: MP_POWER_COST } : snake,
      ),
    };
    const local = queueMpInput(charged, "b", "down");
    const kept = keepLocalIntent(playing, local, "b");
    expect(kept.snakes[1].pending).toBe("down");
    const fired = queueMpFire(local, "b");
    expect(keepLocalIntent(charged, fired, "b").snakes[1].queuedFires).toBe(1);
    const later = { ...charged, tick: charged.tick + 1 };
    expect(keepLocalIntent(later, fired, "b").snakes[1].queuedFires).toBe(0);
    expect(keepLocalIntent(later, local, "b").snakes[1].pending).toBe("down");
  });

  it("does not slow-mo a disconnect", () => {
    const playing = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    const left = killPlayer(playing, "b");
    expect(left.lastDeaths[0]?.cause).toBe("left");
    expect(shouldSlowMo(playing, left)).toBe(false);
    expect(shouldPersonalSlowMo(playing, left, "b")).toBe(false);
    expect(describeDeaths(left.lastDeaths, left.snakes)).toBe("B left");
  });

  it("counts a shared round from every apple eaten", () => {
    let state: MpState = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    expect(mpRound(state.snakes)).toBe(1);
    const head = state.snakes[0].body[0];
    state = {
      ...state,
      foods: [{ x: head.x + 1, y: head.y }],
      snakes: [
        { ...state.snakes[0], direction: "right", pending: "right" },
        state.snakes[1],
      ],
    };
    state = tickMp(state);
    expect(mpRound(state.snakes)).toBe(2);
    expect(state.snakes[0].power).toBe(1);
  });

  it("stores apples past three and spends three per shot", () => {
    let state: MpState = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    const head = state.snakes[0].body[0];
    state = {
      ...state,
      foods: [{ x: head.x + 1, y: head.y }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          power: MP_POWER_COST,
        },
        state.snakes[1],
      ],
    };
    state = tickMp(state);
    expect(state.snakes[0].power).toBe(MP_POWER_COST + 1);
    state = queueMpFire(state, "a");
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
    };
    state = tickMp(state);
    expect(state.snakes[0].power).toBe(1);
    expect(state.snakes[0].queuedFires).toBe(0);
    expect(state.snakes[0].fireCooldown).toBe(MP_FIRE_COOLDOWN);
    expect(state.shots).toHaveLength(1);
    expect(state.shots[0]).toMatchObject({
      ownerId: "a",
      direction: "right",
    });
  });

  it("ignores fire without a full bar", () => {
    let state: MpState = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          body: [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 },
          ],
        },
        state.snakes[1],
      ],
    };
    state = queueMpFire(state, "a");
    const next = tickMp(state);
    expect(next.shots).toEqual([]);
    expect(next.snakes[0].queuedFires).toBe(0);
    expect(next.snakes[0].power).toBe(0);
  });

  it("moves a shot straight and keeps it ahead of the shooter", () => {
    let state: MpState = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          power: MP_POWER_COST,
          body: [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 },
          ],
        },
        state.snakes[1],
      ],
    };
    state = tickMp(queueMpFire(state, "a"));
    expect(state.snakes[0].body[0]).toEqual({ x: 6, y: 10 });
    expect(state.shots[0]).toMatchObject({ x: 7, y: 10, direction: "right" });
    state = tickMp(state);
    expect(state.snakes[0].body[0]).toEqual({ x: 7, y: 10 });
    expect(state.shots[0]).toMatchObject({ x: 8, y: 10 });
  });

  it("lets a shot eat an apple without growing", () => {
    let state: MpState = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    const length = 3;
    state = {
      ...state,
      foods: [{ x: 7, y: 10 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          power: MP_POWER_COST,
          body: [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 },
          ],
        },
        state.snakes[1],
      ],
    };
    state = tickMp(queueMpFire(state, "a"));
    expect(state.shots).toEqual([]);
    expect(state.snakes[0].score).toBe(SOLO_SCORE);
    expect(state.snakes[0].body).toHaveLength(length);
    expect(state.snakes[0].power).toBe(1);
    expect(state.foods.some((food) => food.x === 7 && food.y === 10)).toBe(
      false,
    );
  });

  it("kills on a head hit and cuts a body hit from the head", () => {
    let headShot: MpState = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    headShot = {
      ...headShot,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...headShot.snakes[0],
          direction: "right",
          pending: "right",
          power: MP_POWER_COST,
          body: [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 },
          ],
        },
        {
          ...headShot.snakes[1],
          direction: "right",
          pending: "right",
          body: [
            { x: 7, y: 10 },
            { x: 7, y: 11 },
            { x: 7, y: 12 },
          ],
        },
      ],
    };
    const killed = tickMp(queueMpFire(headShot, "a"));
    expect(killed.status).toBe("countdown");
    expect(killed.roundWinnerId).toBe("a");
    expect(killed.lastDeaths[0]).toMatchObject({
      playerId: "b",
      cause: "shot",
      otherId: "a",
    });
    expect(describeDeaths(killed.lastDeaths, killed.snakes)).toBe("A shot B");

    let bodyShot: MpState = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    bodyShot = {
      ...bodyShot,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...bodyShot.snakes[0],
          direction: "right",
          pending: "right",
          power: MP_POWER_COST,
          body: [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 },
          ],
        },
        {
          ...bodyShot.snakes[1],
          direction: "up",
          pending: "up",
          score: 20,
          body: [
            { x: 7, y: 8 },
            { x: 7, y: 9 },
            { x: 7, y: 10 },
            { x: 7, y: 11 },
            { x: 7, y: 12 },
          ],
        },
      ],
    };
    const grazed = tickMp(queueMpFire(bodyShot, "a"));
    expect(grazed.status).toBe("playing");
    expect(grazed.snakes[1].alive).toBe(true);
    expect(grazed.snakes[1].body[0]).toEqual({ x: 7, y: 7 });
    expect(grazed.snakes[1].body).toEqual([
      { x: 7, y: 7 },
      { x: 7, y: 8 },
    ]);
    expect(grazed.snakes[1].score).toBe(5);
    expect(grazed.snakes[0].score).toBe(3 * SOLO_SCORE);
    expect(grazed.shots).toEqual([]);
  });

  it("waits two turns between queued shots", () => {
    let state: MpState = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          power: MP_POWER_COST * 2,
          body: [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 },
          ],
        },
        state.snakes[1],
      ],
    };
    state = queueMpFire(state, "a");
    state = queueMpFire(state, "a");
    expect(state.snakes[0].queuedFires).toBe(2);
    state = tickMp(state);
    expect(state.shots).toHaveLength(1);
    expect(state.snakes[0].power).toBe(MP_POWER_COST);
    expect(state.snakes[0].queuedFires).toBe(1);
    expect(state.snakes[0].fireCooldown).toBe(MP_FIRE_COOLDOWN);
    state = tickMp(state);
    expect(state.shots).toHaveLength(1);
    expect(state.snakes[0].queuedFires).toBe(1);
    expect(state.snakes[0].fireCooldown).toBe(MP_FIRE_COOLDOWN - 1);
    state = tickMp(state);
    expect(state.shots).toHaveLength(1);
    expect(state.snakes[0].fireCooldown).toBe(0);
    state = tickMp(state);
    expect(state.shots).toHaveLength(2);
    expect(state.snakes[0].power).toBe(0);
    expect(state.snakes[0].queuedFires).toBe(0);
    expect(state.snakes[0].fireCooldown).toBe(MP_FIRE_COOLDOWN);
  });

  it("ranks a finished match by round wins then score", () => {
    const over = startMp(createMpLobby(PLAYERS, 1));
    const ranked = roundStandings([
      { ...over.snakes[0], roundWins: 1, score: 40, name: "A" },
      { ...over.snakes[1], roundWins: 4, score: 5, name: "B", alive: false },
      { ...over.snakes[2], roundWins: 4, score: 25, name: "C", alive: true },
    ]);
    expect(ranked.map((snake) => snake.name)).toEqual(["C", "B", "A"]);
  });

  it("destroys a shot that leaves the board", () => {
    let state: MpState = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          power: MP_POWER_COST,
          body: [
            { x: MP_GRID_WIDTH - 2, y: 10 },
            { x: MP_GRID_WIDTH - 3, y: 10 },
            { x: MP_GRID_WIDTH - 4, y: 10 },
          ],
        },
        state.snakes[1],
      ],
    };
    state = tickMp(queueMpFire(state, "a"));
    expect(state.shots).toEqual([]);
    expect(state.snakes[0].power).toBe(0);
  });

  it("does not move snakes during countdown and ignores fire", () => {
    const counted = beginRound(createMpLobby(PLAYERS.slice(0, 2), 1), 1, {
      resetMatch: true,
    });
    expect(counted.status).toBe("countdown");
    expect(counted.countdown).toBe(MP_COUNTDOWN_START);
    expect(counted.matchRound).toBe(1);
    const head = counted.snakes[0].body[0];
    expect(tickMp(counted)).toBe(counted);
    expect(counted.snakes[0].body[0]).toEqual(head);
    expect(queueMpInput(counted, "a", "down").snakes[0].pending).toBe("down");
    const armed = {
      ...counted,
      snakes: counted.snakes.map((snake) =>
        snake.id === "a" ? { ...snake, power: MP_POWER_COST } : snake,
      ),
    };
    expect(queueMpFire(armed, "a").snakes[0].queuedFires).toBe(0);
    let next = counted;
    next = advanceCountdown(next);
    expect(next.countdown).toBe(2);
    next = advanceCountdown(next);
    expect(next.countdown).toBe(1);
    next = advanceCountdown(next);
    expect(next.status).toBe("playing");
    expect(next.countdown).toBe(0);
  });

  it("starts the next round without waiting for ready", () => {
    let state = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "left",
          pending: "left",
          body: [
            { x: 0, y: 10 },
            { x: 1, y: 10 },
            { x: 2, y: 10 },
          ],
        },
        state.snakes[1],
      ],
    };
    const next = tickMp(state);
    expect(next.status).toBe("countdown");
    expect(next.matchRound).toBe(2);
    expect(next.roundWinnerId).toBe("b");
    expect(next.snakes.every((snake) => snake.alive && snake.score === 0)).toBe(
      true,
    );
    expect(next.snakes.find((snake) => snake.id === "b")?.roundWins).toBe(1);
  });

  it("awards a round to a snake that reaches length 20", () => {
    let state = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          body: Array.from({ length: MP_WIN_LENGTH }, (_, cell) => ({
            x: 20 - cell,
            y: 10,
          })),
        },
        state.snakes[1],
      ],
    };
    const next = tickMp(state);
    expect(next.status).toBe("countdown");
    expect(next.roundWinnerId).toBe("a");
    expect(next.snakes.find((snake) => snake.id === "a")?.roundWins).toBe(1);
  });

  it("ends the match after the tenth round", () => {
    let state = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    state = {
      ...state,
      matchRound: MP_ROUNDS,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "left",
          pending: "left",
          body: [
            { x: 0, y: 10 },
            { x: 1, y: 10 },
            { x: 2, y: 10 },
          ],
        },
        state.snakes[1],
      ],
    };
    const next = tickMp(state);
    expect(next.status).toBe("over");
    expect(next.matchRound).toBe(MP_ROUNDS);
    expect(next.winnerId).toBe("b");
    expect(next.snakes.find((snake) => snake.id === "b")?.roundWins).toBe(1);
    expect(shouldSlowMo(state, next)).toBe(true);
  });

  it("awards a head-shot kill the victim's length", () => {
    let state: MpState = startMp(createMpLobby(PLAYERS, 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          power: MP_POWER_COST,
          body: [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 },
          ],
        },
        {
          ...state.snakes[1],
          direction: "right",
          pending: "right",
          body: [
            { x: 7, y: 10 },
            { x: 7, y: 11 },
            { x: 7, y: 12 },
            { x: 7, y: 13 },
          ],
        },
        state.snakes[2],
      ],
    };
    const next = tickMp(queueMpFire(state, "a"));
    expect(next.status).toBe("playing");
    expect(next.snakes[1].alive).toBe(false);
    expect(next.snakes[0].score).toBe(4 * SOLO_SCORE);
  });

  it("awards a body-collision kill to the snake that was hit", () => {
    let state = startMp(createMpLobby(PLAYERS, 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          body: [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 },
          ],
        },
        {
          ...state.snakes[1],
          direction: "right",
          pending: "right",
          body: [
            { x: 7, y: 10 },
            { x: 6, y: 10 },
            { x: 5, y: 10 },
          ],
        },
        state.snakes[2],
      ],
    };
    const next = tickMp(state);
    expect(next.snakes[0].alive).toBe(false);
    expect(next.snakes[1].alive).toBe(true);
    expect(next.snakes[1].score).toBe(3 * SOLO_SCORE);
  });

  it("does not turbo without a bar or during countdown", () => {
    const counted = beginRound(createMpLobby(PLAYERS.slice(0, 2), 1), 1, {
      resetMatch: true,
    });
    expect(queueMpTurbo(counted, "a").snakes[0].queuedTurbo).toBe(0);
    let playing = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    expect(queueMpTurbo(playing, "a").snakes[0].queuedTurbo).toBe(0);
    playing = {
      ...playing,
      snakes: playing.snakes.map((snake) =>
        snake.id === "a" ? { ...snake, power: MP_POWER_COST } : snake,
      ),
    };
    expect(queueMpTurbo(playing, "a").snakes[0].queuedTurbo).toBe(1);
  });

  it("moves a turbo snake two cells per world tick", () => {
    let state: MpState = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          power: MP_POWER_COST,
          body: [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 },
          ],
        },
        {
          ...state.snakes[1],
          direction: "left",
          pending: "left",
          body: [
            { x: MP_GRID_WIDTH - 3, y: 20 },
            { x: MP_GRID_WIDTH - 2, y: 20 },
            { x: MP_GRID_WIDTH - 1, y: 20 },
          ],
        },
      ],
    };
    state = tickMp(queueMpTurbo(state, "a"));
    expect(state.snakes[0].body[0]).toEqual({ x: 7, y: 10 });
    expect(state.snakes[0].power).toBe(0);
    expect(state.snakes[0].turboLeft).toBe(MP_TURBO_TICKS - 1);
    for (let step = 0; step < MP_TURBO_TICKS - 1; step += 1) {
      state = tickMp(state);
    }
    expect(state.snakes[0].turboLeft).toBe(0);
    const x = state.snakes[0].body[0].x;
    state = tickMp(state);
    expect(state.snakes[0].body[0].x).toBe(x + 1);
  });

  it("lets the longer heading win a last-tick head crash", () => {
    let state = startMp(createMpLobby(PLAYERS, 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          headingHold: 8,
          body: [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 },
          ],
        },
        {
          ...state.snakes[1],
          direction: "down",
          pending: "left",
          headingHold: 4,
          body: [
            { x: 6, y: 10 },
            { x: 6, y: 11 },
            { x: 6, y: 12 },
          ],
        },
        state.snakes[2],
      ],
    };
    const next = tickMp(state);
    expect(next.status).toBe("playing");
    expect(next.snakes[0].alive).toBe(true);
    expect(next.snakes[1].alive).toBe(false);
    expect(next.snakes[0].body[0]).toEqual({ x: 6, y: 10 });
    expect(next.snakes[0].score).toBe(3 * SOLO_SCORE);
    expect(next.lastDeaths).toEqual([
      { playerId: "b", cause: "head", otherId: "a" },
    ]);
    expect(describeDeaths(next.lastDeaths, next.snakes)).toBe("B ran into A");

    const through = tickMp(queueMpInput(next, "a", "down"));
    expect(through.snakes[0].alive).toBe(true);
    expect(through.snakes[0].body[0]).toEqual({ x: 6, y: 11 });
  });

  it("does not award kill points on an equal-hold head crash", () => {
    const fourth: MpPlayer = {
      id: "d",
      name: "D",
      color: "#444",
      host: false,
      ready: false,
      joinedAt: 4,
    };
    let state = startMp(createMpLobby([...PLAYERS, fourth], 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          headingHold: 5,
          body: [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 },
          ],
        },
        {
          ...state.snakes[1],
          direction: "left",
          pending: "left",
          headingHold: 5,
          body: [
            { x: 7, y: 10 },
            { x: 8, y: 10 },
            { x: 9, y: 10 },
          ],
        },
        state.snakes[2],
        state.snakes[3],
      ],
    };
    const next = tickMp(state);
    expect(next.status).toBe("playing");
    expect(next.snakes[0].alive).toBe(false);
    expect(next.snakes[1].alive).toBe(false);
    expect(next.snakes[0].score).toBe(0);
    expect(next.snakes[1].score).toBe(0);
    expect(describeDeaths(next.lastDeaths, next.snakes)).toBe(
      "A and B crashed",
    );
  });

  it("plants a bomb at the current tail and spends a power bar", () => {
    let state: MpState = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          power: MP_POWER_COST,
          body: [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 },
          ],
        },
        {
          ...state.snakes[1],
          direction: "left",
          pending: "left",
          body: [
            { x: 20, y: 20 },
            { x: 21, y: 20 },
            { x: 22, y: 20 },
          ],
        },
      ],
    };
    state = tickMp(queueMpBomb(state, "a"));
    expect(state.bombs).toEqual([
      { ownerId: "a", x: 3, y: 10, fuse: MP_BOMB_FUSE_TICKS - 1 },
    ]);
    expect(state.snakes[0].body[0]).toEqual({ x: 6, y: 10 });
    expect(state.snakes[0].power).toBe(0);
    expect(state.snakes[0].queuedBombs).toBe(0);
  });

  it("counts down a bomb fuse and ignores snakes outside the blast", () => {
    let state: MpState = startMp(createMpLobby(PLAYERS, 1));
    state = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      bombs: [{ ownerId: "a", x: 10, y: 10, fuse: 2 }],
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          body: [
            { x: 16, y: 10 },
            { x: 15, y: 10 },
            { x: 14, y: 10 },
          ],
        },
        {
          ...state.snakes[1],
          direction: "left",
          pending: "left",
          body: [
            { x: 20, y: 20 },
            { x: 21, y: 20 },
            { x: 22, y: 20 },
          ],
        },
        {
          ...state.snakes[2],
          direction: "right",
          pending: "right",
          body: [
            { x: 2, y: 20 },
            { x: 1, y: 20 },
            { x: 0, y: 20 },
          ],
        },
      ],
    };
    state = tickMp(state);
    expect(state.bombs[0]?.fuse).toBe(1);
    expect(state.snakes.every((snake) => snake.alive)).toBe(true);
    const next = tickMp(state);
    expect(next.bombs).toEqual([]);
    expect(next.snakes.every((snake) => snake.alive)).toBe(true);
  });

  it("kills head, body, and the planter in blast radius", () => {
    const state = startMp(createMpLobby(PLAYERS, 1));
    const parked = {
      ...state.snakes[2],
      direction: "right" as const,
      pending: "right" as const,
      body: [
        { x: 2, y: 20 },
        { x: 1, y: 20 },
        { x: 0, y: 20 },
      ],
    };
    const base = {
      ...state,
      foods: [{ x: 0, y: 0 }],
      bombs: [{ ownerId: "a", x: 10, y: 10, fuse: 1 }],
    };
    const headHit = tickMp({
      ...base,
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          body: [
            { x: 8, y: 10 },
            { x: 7, y: 10 },
            { x: 6, y: 10 },
          ],
        },
        {
          ...state.snakes[1],
          direction: "left",
          pending: "left",
          body: [
            { x: 20, y: 20 },
            { x: 21, y: 20 },
            { x: 22, y: 20 },
          ],
        },
        parked,
      ],
    });
    expect(headHit.status).toBe("playing");
    expect(headHit.snakes[0].alive).toBe(false);
    expect(headHit.lastDeaths[0]).toMatchObject({
      playerId: "a",
      cause: "bomb",
      otherId: "a",
    });
    expect(describeDeaths(headHit.lastDeaths, headHit.snakes)).toBe("A blew up");

    const bodyHit = tickMp({
      ...base,
      snakes: [
        {
          ...state.snakes[0],
          direction: "right",
          pending: "right",
          body: [
            { x: 20, y: 4 },
            { x: 19, y: 4 },
            { x: 18, y: 4 },
          ],
        },
        {
          ...state.snakes[1],
          direction: "right",
          pending: "right",
          body: [
            { x: 12, y: 11 },
            { x: 11, y: 11 },
            { x: 10, y: 11 },
          ],
        },
        parked,
      ],
    });
    expect(bodyHit.snakes[1].alive).toBe(false);
    expect(bodyHit.snakes[0].alive).toBe(true);
    expect(bodyHit.lastDeaths[0]).toMatchObject({
      playerId: "b",
      cause: "bomb",
      otherId: "a",
    });
    expect(describeDeaths(bodyHit.lastDeaths, bodyHit.snakes)).toBe("A bombed B");
  });

  it("ignores a bomb without a full bar and keeps guest bombs on the same tick", () => {
    const playing = startMp(createMpLobby(PLAYERS.slice(0, 2), 1));
    expect(queueMpBomb(playing, "a").snakes[0].queuedBombs).toBe(0);
    const charged = {
      ...playing,
      snakes: playing.snakes.map((snake) =>
        snake.id === "b" ? { ...snake, power: MP_POWER_COST } : snake,
      ),
    };
    const fired = queueMpFire(charged, "b");
    expect(queueMpBomb(fired, "b").snakes[1].queuedBombs).toBe(0);
    const bombed = queueMpBomb(charged, "b");
    expect(keepLocalIntent(charged, bombed, "b").snakes[1].queuedBombs).toBe(1);
    const later = { ...charged, tick: charged.tick + 1 };
    expect(keepLocalIntent(later, bombed, "b").snakes[1].queuedBombs).toBe(0);
    expect(fromWireState(toWireState(bombed))?.snakes[1].queuedBombs).toBe(1);
  });
});
