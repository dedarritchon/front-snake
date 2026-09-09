const WINDOW_MS = 1000;

export function payloadJson(payload: unknown): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return "";
  }
}

export function payloadBytes(payload: unknown): number {
  if (typeof payload === "string") {
    return payload.length;
  }
  return payloadJson(payload).length;
}

export function wireBitsPerSec(bytes: number, tickMs: number): number {
  if (bytes <= 0 || tickMs <= 0) {
    return 0;
  }
  return (bytes * 8 * 1000) / tickMs;
}

export function formatMbps(bitsPerSec: number): string {
  const mb = bitsPerSec / 1_000_000;
  if (mb < 0.05) {
    return "0 Mb/s";
  }
  const rounded = Math.round(mb * 10) / 10;
  if (Number.isInteger(rounded)) {
    return `${rounded} Mb/s`;
  }
  return `${rounded.toFixed(1)} Mb/s`;
}

export function createByteRate() {
  const samples: { t: number; n: number }[] = [];

  function prune(now: number): void {
    const cut = now - WINDOW_MS;
    while (samples.length > 0 && samples[0].t < cut) {
      samples.shift();
    }
  }

  return {
    record(bytes: number): void {
      if (bytes <= 0) {
        return;
      }
      const now = performance.now();
      samples.push({ t: now, n: bytes });
      prune(now);
    },
    bitsPerSec(): number {
      const now = performance.now();
      prune(now);
      let total = 0;
      for (const sample of samples) {
        total += sample.n;
      }
      return (total * 8 * 1000) / WINDOW_MS;
    },
  };
}
