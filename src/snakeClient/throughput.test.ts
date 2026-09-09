import { describe, expect, it } from "vitest";

import {
  createByteRate,
  formatMbps,
  payloadBytes,
  wireBitsPerSec,
} from "./throughput";

describe("formatMbps", () => {
  it("shows decimal megabits", () => {
    expect(formatMbps(0)).toBe("0 Mb/s");
    expect(formatMbps(40_000)).toBe("0 Mb/s");
    expect(formatMbps(1_000_000)).toBe("1 Mb/s");
    expect(formatMbps(1_240_000)).toBe("1.2 Mb/s");
  });
});

describe("createByteRate", () => {
  it("counts bits over a rolling second", () => {
    const rate = createByteRate();
    rate.record(125_000);
    expect(rate.bitsPerSec()).toBe(1_000_000);
    expect(formatMbps(rate.bitsPerSec())).toBe("1 Mb/s");
  });
});

describe("payloadBytes", () => {
  it("uses JSON length", () => {
    expect(payloadBytes({ a: 1 })).toBe(JSON.stringify({ a: 1 }).length);
  });

  it("counts a prestringified payload without encoding again", () => {
    const json = JSON.stringify({ a: 1 });
    expect(payloadBytes(json)).toBe(json.length);
  });
});

describe("wireBitsPerSec", () => {
  it("scales bytes by the tick rate", () => {
    expect(wireBitsPerSec(125, 1000)).toBe(1000);
    expect(wireBitsPerSec(0, 140)).toBe(0);
  });
});
