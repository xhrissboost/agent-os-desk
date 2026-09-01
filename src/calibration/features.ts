import type { Kline } from "../types.js";

export type Sample = {
  t: number;
  x: [number, number, number];
  y: 0 | 1;
};

function std(xs: number[]): number {
  if (xs.length < 2) return xs.length === 1 ? Math.abs(xs[0] ?? 0) : 0;
  let sum = 0;
  for (const v of xs) sum += v;
  const mean = sum / xs.length;
  let varSum = 0;
  for (const v of xs) varSum += (v - mean) ** 2;
  return Math.sqrt(varSum / (xs.length - 1));
}

/**
 * Features from L lookback bars ending at index t:
 * lookback return, high-low range / close, std of log-returns (vol).
 */
export function lookbackFeatures(
  klines: Kline[],
  t: number,
  lookback: number,
): [number, number, number] | null {
  if (lookback < 1 || t - lookback < 0 || t >= klines.length) return null;
  const start = klines[t - lookback];
  const end = klines[t];
  if (!start || !end || start.close <= 0 || end.close <= 0) return null;
  const ret = end.close / start.close - 1;
  let hi = -Infinity;
  let lo = Infinity;
  const logrets: number[] = [];
  for (let i = t - lookback + 1; i <= t; i++) {
    const bar = klines[i];
    const prev = klines[i - 1];
    if (!bar || !prev) return null;
    hi = Math.max(hi, bar.high);
    lo = Math.min(lo, bar.low);
    if (prev.close > 0 && bar.close > 0) {
      logrets.push(Math.log(bar.close / prev.close));
    }
  }
  const range = (hi - lo) / end.close;
  const vol = logrets.length ? std(logrets) : Math.abs(ret);
  if (![ret, range, vol].every(Number.isFinite)) return null;
  return [ret, range, vol];
}

/** Causal rolling up-frequency over the last L 1-bar moves (baseline ŷ). */
export function rollingUpFrequency(klines: Kline[], t: number, lookback: number): number | null {
  if (lookback < 1 || t - lookback < 0 || t >= klines.length) return null;
  let ups = 0;
  for (let i = t - lookback + 1; i <= t; i++) {
    const bar = klines[i];
    const prev = klines[i - 1];
    if (!bar || !prev) return null;
    if (bar.close > prev.close) ups += 1;
  }
  return ups / lookback;
}

export function buildSamples(klines: Kline[], lookback: number, horizon: number): Sample[] {
  const out: Sample[] = [];
  const last = klines.length - 1 - horizon;
  for (let t = lookback; t <= last; t++) {
    const x = lookbackFeatures(klines, t, lookback);
    const now = klines[t];
    const fut = klines[t + horizon];
    if (!x || !now || !fut) continue;
    out.push({
      t,
      x,
      y: fut.close > now.close ? 1 : 0,
    });
  }
  return out;
}
