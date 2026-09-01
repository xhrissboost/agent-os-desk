import {
  DEPTH_LIMIT,
  FUTURES_REST_HOSTS,
  KLINE_INTERVAL,
  KLINE_LIMIT,
  MIN_NOTIONAL_FALLBACK_USDT,
  SPOT_REST_HOSTS,
} from "../config.js";
import { fetchJson, isGeoBlocked } from "../http.js";
import type { DataSource, DepthBook, FundingPrint, Kline, SpotFilters, Ticker24h } from "../types.js";
import {
  parseDepth,
  parseKlines,
  parsePremiumIndex,
  parseTicker24h,
} from "./parse.js";
import { parseSpotFilters } from "./filters.js";
import { FIXTURE_DEPTH, FIXTURE_EXCHANGE_INFO, FIXTURE_FUNDING, FIXTURE_KLINES, FIXTURE_TICKER } from "./fixtures.js";

export class RestUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestUnavailable";
  }
}

async function firstOk<T>(
  hosts: readonly string[],
  path: string,
  parse: (json: unknown, host: string) => T,
): Promise<{ value: T; source: DataSource }> {
  const errors: string[] = [];
  for (const host of hosts) {
    const url = `${host}${path}`;
    try {
      const { json, host: used } = await fetchJson(url);
      if (isGeoBlocked(json)) {
        errors.push(`${used}: geo-blocked`);
        continue;
      }
      return {
        value: parse(json, used),
        source: { kind: "rest", host: used },
      };
    } catch (err) {
      errors.push(`${host}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new RestUnavailable(errors.join(" | "));
}

export async function fetchTicker(symbol: string): Promise<{ ticker: Ticker24h; source: DataSource }> {
  try {
    const { value, source } = await firstOk(SPOT_REST_HOSTS, `/api/v3/ticker/24hr?symbol=${symbol}`, (json) =>
      parseTicker24h(json, symbol),
    );
    return { ticker: value, source };
  } catch {
    return {
      ticker: parseTicker24h(FIXTURE_TICKER[symbol] ?? FIXTURE_TICKER.BNBUSDT, symbol),
      source: { kind: "fixture", note: "public REST unreachable; using recorded snapshot" },
    };
  }
}

export async function fetchDepth(symbol: string): Promise<{ book: DepthBook; source: DataSource }> {
  try {
    const { value, source } = await firstOk(
      SPOT_REST_HOSTS,
      `/api/v3/depth?symbol=${symbol}&limit=${DEPTH_LIMIT}`,
      (json) => parseDepth(json, symbol),
    );
    return { book: value, source };
  } catch {
    return {
      book: parseDepth(FIXTURE_DEPTH[symbol] ?? FIXTURE_DEPTH.BNBUSDT, symbol),
      source: { kind: "fixture", note: "public REST unreachable; using recorded snapshot" },
    };
  }
}

export async function fetchKlines(symbol: string): Promise<{ klines: Kline[]; source: DataSource }> {
  try {
    const { value, source } = await firstOk(
      SPOT_REST_HOSTS,
      `/api/v3/klines?symbol=${symbol}&interval=${KLINE_INTERVAL}&limit=${KLINE_LIMIT}`,
      (json) => parseKlines(json),
    );
    return { klines: value, source };
  } catch {
    return {
      klines: parseKlines(FIXTURE_KLINES[symbol] ?? FIXTURE_KLINES.BNBUSDT),
      source: { kind: "fixture", note: "public REST unreachable; using recorded snapshot" },
    };
  }
}

export async function fetchFunding(symbol: string): Promise<{ funding: FundingPrint; source: DataSource }> {
  try {
    const { value, source } = await firstOk(
      FUTURES_REST_HOSTS,
      `/fapi/v1/premiumIndex?symbol=${symbol}`,
      (json) => parsePremiumIndex(json, symbol),
    );
    return { funding: value, source };
  } catch {
    return {
      funding: parsePremiumIndex(FIXTURE_FUNDING[symbol] ?? FIXTURE_FUNDING.BNBUSDT, symbol),
      source: { kind: "fixture", note: "futures REST unreachable; using recorded snapshot" },
    };
  }
}

export async function fetchSpotFilters(symbol: string): Promise<SpotFilters> {
  try {
    const { value } = await firstOk(
      SPOT_REST_HOSTS,
      `/api/v3/exchangeInfo?symbol=${symbol}`,
      (json, host) => parseSpotFilters(json, symbol, { kind: "rest", host }),
    );
    return value;
  } catch {
    try {
      return parseSpotFilters(FIXTURE_EXCHANGE_INFO, symbol, {
        kind: "fixture",
        note: `exchangeInfo unreachable; fallback minNotional ${MIN_NOTIONAL_FALLBACK_USDT} USDT (observed 2026-09-01)`,
      });
    } catch {
      return {
        symbol,
        minNotional: MIN_NOTIONAL_FALLBACK_USDT,
        minQty: 0.001,
        stepSize: 0.001,
        source: {
          kind: "fixture",
          note: `no exchangeInfo; fallback minNotional ${MIN_NOTIONAL_FALLBACK_USDT} USDT as of 2026-09-01`,
        },
      };
    }
  }
}
