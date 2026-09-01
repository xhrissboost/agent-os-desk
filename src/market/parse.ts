import { isGeoBlocked, num, str } from "../http.js";
import type { DepthBook, FundingPrint, Kline, Ticker24h } from "../types.js";

export function assertNotGeoBlocked(body: unknown, host: string): void {
  if (isGeoBlocked(body)) {
    throw new Error(`geo-blocked at ${host}`);
  }
}

export function parseTicker24h(body: unknown, symbol: string): Ticker24h {
  if (!body || typeof body !== "object") {
    throw new Error(`ticker: empty body for ${symbol}`);
  }
  const rec = body as Record<string, unknown>;
  if (isGeoBlocked(rec)) {
    throw new Error(`ticker: geo-blocked for ${symbol}`);
  }
  const sym = str(rec.symbol, symbol);
  const last = num(rec.lastPrice);
  if (!last) throw new Error(`ticker: missing lastPrice for ${symbol}`);
  return {
    symbol: sym,
    lastPrice: last,
    bidPrice: num(rec.bidPrice),
    askPrice: num(rec.askPrice),
    priceChangePercent: num(rec.priceChangePercent),
    volume: num(rec.volume),
    quoteVolume: num(rec.quoteVolume),
    highPrice: num(rec.highPrice),
    lowPrice: num(rec.lowPrice),
  };
}

export function parseDepth(body: unknown, symbol: string): DepthBook {
  if (!body || typeof body !== "object") {
    throw new Error(`depth: empty body for ${symbol}`);
  }
  const rec = body as Record<string, unknown>;
  if (isGeoBlocked(rec)) {
    throw new Error(`depth: geo-blocked for ${symbol}`);
  }
  const mapLevels = (raw: unknown): Array<[number, number]> => {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((row) => {
        if (!Array.isArray(row) || row.length < 2) return null;
        const price = num(row[0]);
        const qty = num(row[1]);
        if (!price || qty < 0) return null;
        return [price, qty] as [number, number];
      })
      .filter((x): x is [number, number] => x !== null);
  };
  return {
    symbol,
    lastUpdateId: num(rec.lastUpdateId),
    bids: mapLevels(rec.bids),
    asks: mapLevels(rec.asks),
  };
}

export function parseKlines(body: unknown): Kline[] {
  if (!Array.isArray(body)) {
    if (isGeoBlocked(body)) throw new Error("klines: geo-blocked");
    throw new Error("klines: expected array");
  }
  return body
    .map((row) => {
      if (!Array.isArray(row) || row.length < 7) return null;
      return {
        openTime: num(row[0]),
        open: num(row[1]),
        high: num(row[2]),
        low: num(row[3]),
        close: num(row[4]),
        volume: num(row[5]),
        closeTime: num(row[6]),
      } satisfies Kline;
    })
    .filter((k): k is Kline => k !== null && k.close > 0);
}

export function parsePremiumIndex(body: unknown, symbol: string): FundingPrint {
  if (!body || typeof body !== "object") {
    throw new Error(`funding: empty body for ${symbol}`);
  }
  const rec = body as Record<string, unknown>;
  if (isGeoBlocked(rec)) {
    throw new Error(`funding: geo-blocked for ${symbol}`);
  }
  return {
    symbol: str(rec.symbol, symbol),
    markPrice: num(rec.markPrice),
    indexPrice: num(rec.indexPrice),
    lastFundingRate: num(rec.lastFundingRate),
    nextFundingTime: num(rec.nextFundingTime),
  };
}

export function parseBalances(body: unknown): Array<{ asset: string; free: string; locked: string }> {
  if (Array.isArray(body)) {
    return body
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const rec = row as Record<string, unknown>;
        const asset = str(rec.asset ?? rec.coin);
        if (!asset) return null;
        return {
          asset,
          free: str(rec.free ?? rec.available ?? rec.walletBalance, "0"),
          locked: str(rec.locked ?? rec.frozen, "0"),
        };
      })
      .filter((x): x is { asset: string; free: string; locked: string } => x !== null);
  }
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    if (Array.isArray(rec.balances)) return parseBalances(rec.balances);
    if (Array.isArray(rec.assets)) return parseBalances(rec.assets);
  }
  return [];
}
