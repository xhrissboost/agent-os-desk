import { asRecord, num, str } from "../http.js";
import type { DataSource, SpotFilters } from "../types.js";

export function parseSpotFilters(body: unknown, symbol: string, source: DataSource): SpotFilters {
  const rec = asRecord(body);
  const symbols = Array.isArray(rec?.symbols) ? rec.symbols : [];
  const row = symbols
    .map((s: unknown) => asRecord(s))
    .find((s) => s && str(s.symbol) === symbol);
  const filters = Array.isArray(row?.filters) ? row.filters : [];

  let minNotional = 0;
  let minQty = 0;
  let stepSize = 0;
  for (const raw of filters) {
    const f = asRecord(raw);
    if (!f) continue;
    const kind = str(f.filterType);
    if (kind === "NOTIONAL" || kind === "MIN_NOTIONAL") {
      minNotional = num(f.minNotional ?? f.notional);
    }
    if (kind === "LOT_SIZE") {
      minQty = num(f.minQty);
      stepSize = num(f.stepSize);
    }
  }
  if (!minNotional) {
    throw new Error(`exchangeInfo: missing NOTIONAL/MIN_NOTIONAL for ${symbol}`);
  }
  return { symbol, minNotional, minQty, stepSize, source };
}

export function quotePlusFees(minNotional: number, takerFeeBps: number, bufferUsdt: number): number {
  return minNotional * (1 + takerFeeBps / 10_000) + bufferUsdt;
}
