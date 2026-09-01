import { clamp, num } from "../http.js";
import type { BookLevels, DepthBook, Kline, SupportResistance } from "../types.js";

export function bookLevels(book: DepthBook): BookLevels {
  const bidQty = book.bids.reduce((s, [, q]) => s + q, 0);
  const askQty = book.asks.reduce((s, [, q]) => s + q, 0);
  const denom = bidQty + askQty;
  const imbalance = denom === 0 ? 0 : clamp((bidQty - askQty) / denom, -1, 1);
  const bestBid = book.bids[0]?.[0] ?? 0;
  const bestAsk = book.asks[0]?.[0] ?? 0;
  const mid = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : bestBid || bestAsk;
  const spreadBps = mid ? ((bestAsk - bestBid) / mid) * 10_000 : 0;
  return { imbalance, bidQty, askQty, mid, spreadBps };
}

export function supportResistance(klines: Kline[]): SupportResistance {
  if (klines.length === 0) {
    return { support: 0, resistance: 0, last: 0, distToSupportPct: 0, distToResistancePct: 0 };
  }
  const last = klines[klines.length - 1]!.close;
  const lows = klines.map((k) => k.low);
  const highs = klines.map((k) => k.high);
  const support = Math.min(...lows);
  const resistance = Math.max(...highs);
  return {
    support,
    resistance,
    last,
    distToSupportPct: support ? ((last - support) / support) * 100 : 0,
    distToResistancePct: last ? ((resistance - last) / last) * 100 : 0,
  };
}

export function quoteUsd(baseQty: number, price: number): number {
  return num(baseQty) * num(price);
}
