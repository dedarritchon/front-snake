export type NetField = string | number | boolean | null | undefined;

export function netLine(
  kind: string,
  fields: Record<string, NetField> = {},
): string {
  const body = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  return body.length > 0 ? `[snake] ${kind} ${body}` : `[snake] ${kind}`;
}

export function logNet(
  kind: string,
  fields: Record<string, NetField> = {},
): void {
  console.log(netLine(kind, fields));
}

export interface NetStatsSnapshot {
  snaps: number;
  predicts: number;
  drops: number;
  avgDt: number;
  maxDt: number;
  bytesIn: number;
  bytesOut: number;
}

export function createNetStats(windowMs = 2000) {
  let snaps = 0;
  let predicts = 0;
  let drops = 0;
  let sumDt = 0;
  let maxDt = 0;
  let bytesIn = 0;
  let bytesOut = 0;
  let flushedAt = 0;
  let started = false;

  function snapshot(): NetStatsSnapshot {
    return {
      snaps,
      predicts,
      drops,
      avgDt: snaps > 0 ? Math.round(sumDt / snaps) : 0,
      maxDt: Math.round(maxDt),
      bytesIn,
      bytesOut,
    };
  }

  function reset(): void {
    snaps = 0;
    predicts = 0;
    drops = 0;
    sumDt = 0;
    maxDt = 0;
    bytesIn = 0;
    bytesOut = 0;
    flushedAt = 0;
    started = false;
  }

  return {
    recordSnap(dt: number, bytes: number): void {
      snaps += 1;
      sumDt += dt;
      if (dt > maxDt) {
        maxDt = dt;
      }
      if (bytes > 0) {
        bytesIn += bytes;
      }
    },
    recordPredict(): void {
      predicts += 1;
    },
    recordDrop(): void {
      drops += 1;
    },
    recordOut(bytes: number): void {
      if (bytes > 0) {
        bytesOut += bytes;
      }
    },
    snapshot,
    reset,
    flushIfDue(now: number): NetStatsSnapshot | null {
      if (!started) {
        started = true;
        flushedAt = now;
        return null;
      }
      if (now - flushedAt < windowMs) {
        return null;
      }
      const current = snapshot();
      snaps = 0;
      predicts = 0;
      drops = 0;
      sumDt = 0;
      maxDt = 0;
      bytesIn = 0;
      bytesOut = 0;
      flushedAt = now;
      return current;
    },
  };
}
