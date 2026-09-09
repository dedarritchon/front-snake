const WINDOW_MS = 1000;

export function payloadBytes(payload: unknown): number {
  try {
    return JSON.stringify(payload).length;
  } catch {
    return 0;
  }
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
