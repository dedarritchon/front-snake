import { describe, expect, it } from "vitest";

import { createNetStats, netLine } from "./netDebug";

describe("netLine", () => {
  it("formats a tagged key=value line", () => {
    expect(netLine("snap", { tick: 4, dt: 148, host: false })).toBe(
      "[snake] snap tick=4 dt=148 host=false",
    );
  });

  it("omits nullish fields", () => {
    expect(netLine("drop", { tick: 3, last: undefined, gap: null })).toBe(
      "[snake] drop tick=3",
    );
  });
});

describe("createNetStats", () => {
  it("averages snapshot gaps and counts predicts", () => {
    const stats = createNetStats();
    stats.recordSnap(100, 200);
    stats.recordSnap(200, 100);
    stats.recordPredict();
    stats.recordDrop();
    stats.recordOut(50);
    expect(stats.snapshot()).toEqual({
      snaps: 2,
      predicts: 1,
      drops: 1,
      avgDt: 150,
      maxDt: 200,
      bytesIn: 300,
      bytesOut: 50,
    });
    stats.reset();
    expect(stats.snapshot().snaps).toBe(0);
  });

  it("flushes a windowed summary", () => {
    const stats = createNetStats(100);
    expect(stats.flushIfDue(0)).toBeNull();
    stats.recordSnap(140, 80);
    expect(stats.flushIfDue(50)).toBeNull();
    expect(stats.flushIfDue(100)).toEqual({
      snaps: 1,
      predicts: 0,
      drops: 0,
      avgDt: 140,
      maxDt: 140,
      bytesIn: 80,
      bytesOut: 0,
    });
    expect(stats.snapshot().snaps).toBe(0);
  });
});
