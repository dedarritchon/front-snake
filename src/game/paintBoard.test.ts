import { describe, expect, it } from "vitest";

import { bombBlinkOn, lerpAmount, lerpBodies, shouldLerpMp } from "./paintBoard";

describe("lerpBodies", () => {
  it("keeps extra grown segments at the current position", () => {
    const prev = [
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const curr = [
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(lerpBodies(prev, curr, 0.5)).toEqual([
      { x: 1.5, y: 1 },
      { x: 0.5, y: 1 },
      { x: 0, y: 1 },
    ]);
  });

  it("slides every segment into the next cell", () => {
    const prev = [
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const curr = [
      { x: 3, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
    ];
    expect(lerpBodies(prev, curr, 0.5)).toEqual([
      { x: 2.5, y: 1 },
      { x: 1.5, y: 1 },
      { x: 0.5, y: 1 },
    ]);
  });

  it("keeps a turn on the grid as each block moves into the next", () => {
    const prev = [
      { x: 5, y: 10 },
      { x: 5, y: 11 },
      { x: 4, y: 11 },
    ];
    const curr = [
      { x: 5, y: 9 },
      { x: 5, y: 10 },
      { x: 5, y: 11 },
    ];
    expect(lerpBodies(prev, curr, 0.5)).toEqual([
      { x: 5, y: 9.5 },
      { x: 5, y: 10.5 },
      { x: 4.5, y: 11 },
    ]);
  });

  it("moves a diagonal jump on an L instead of a shortcut", () => {
    expect(lerpBodies([{ x: 0, y: 0 }], [{ x: 1, y: 1 }], 0.25)).toEqual([
      { x: 0.5, y: 0 },
    ]);
    expect(lerpBodies([{ x: 0, y: 0 }], [{ x: 1, y: 1 }], 0.75)).toEqual([
      { x: 1, y: 0.5 },
    ]);
  });

  it("returns current when t is 1", () => {
    const curr = [{ x: 2, y: 3 }];
    expect(lerpBodies([{ x: 0, y: 0 }], curr, 1)).toBe(curr);
  });
});

describe("lerpAmount", () => {
  it("clamps between 0 and 1", () => {
    expect(lerpAmount(100, 50, 90, false)).toBe(0);
    expect(lerpAmount(100, 50, 125, false)).toBe(0.5);
    expect(lerpAmount(100, 50, 200, false)).toBe(1);
    expect(lerpAmount(100, 50, 125, true)).toBe(1);
  });
});

describe("shouldLerpMp", () => {
  it("lerps one playing tick and skips jumps", () => {
    expect(
      shouldLerpMp(
        { tick: 3, replayIndex: 0, status: "playing" },
        { tick: 4, replayIndex: 0, status: "playing" },
      ),
    ).toBe(true);
    expect(
      shouldLerpMp(
        { tick: 3, replayIndex: 0, status: "playing" },
        { tick: 5, replayIndex: 0, status: "playing" },
      ),
    ).toBe(false);
    expect(
      shouldLerpMp(
        { tick: 3, replayIndex: 0, status: "countdown" },
        { tick: 4, replayIndex: 0, status: "countdown" },
      ),
    ).toBe(false);
  });
});

describe("bombBlinkOn", () => {
  it("blinks faster each second", () => {
    expect(bombBlinkOn(21, 21, 140, 0, 0)).toBe(true);
    expect(bombBlinkOn(21, 21, 140, 0, 200)).toBe(true);
    expect(bombBlinkOn(21, 21, 140, 0, 400)).toBe(false);
    expect(bombBlinkOn(14, 21, 140, 0, 0)).toBe(true);
    expect(bombBlinkOn(14, 21, 140, 0, 200)).toBe(false);
    expect(bombBlinkOn(7, 21, 140, 0, 140)).toBe(false);
  });
});
