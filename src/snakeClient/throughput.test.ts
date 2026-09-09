import { describe, expect, it } from "vitest";

import { createByteRate, formatMbps, payloadBytes } from "./throughput";

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
});
