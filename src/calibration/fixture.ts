import type { Kline } from "../types.js";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic synthetic BTC-like 1h bars for tests and offline fallback. */
export function makeFixtureKlines(n = 480, seed = 42): Kline[] {
  const rng = mulberry32(seed);
  const bars: Kline[] = [];
  let px = 77_000;
  let t = Date.UTC(2026, 0, 1);
  const hour = 3_600_000;
  for (let i = 0; i < n; i++) {
    const u1 = Math.max(1e-9, rng());
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const drift = 0.00012;
    const ret = drift + 0.0042 * z;
    const open = px;
    px = Math.max(1, px * Math.exp(ret));
    const close = px;
    const wick = (0.0006 + 0.0018 * rng()) * close;
    const high = Math.max(open, close) + wick;
    const low = Math.max(1, Math.min(open, close) - wick);
    bars.push({
      openTime: t,
      open,
      high,
      low,
      close,
      volume: 50 + rng() * 80,
      closeTime: t + hour - 1,
    });
    t += hour;
  }
  return bars;
}
