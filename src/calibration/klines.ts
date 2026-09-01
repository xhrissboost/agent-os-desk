import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  CALIB_BARS,
  CALIB_CACHE_DIR,
  CALIB_CACHE_TTL_MS,
  CALIB_INTERVAL,
  CALIB_SYMBOL,
  SPOT_REST_HOSTS,
} from "../config.js";
import { fetchJson, isGeoBlocked } from "../http.js";
import { parseKlines } from "../market/parse.js";
import type { DataSource, Kline } from "../types.js";
import { makeFixtureKlines } from "./fixture.js";

type CacheFile = {
  symbol: string;
  interval: string;
  fetchedAt: number;
  host?: string;
  klines: Kline[];
};

function cachePath(symbol: string, interval: string): string {
  return join(CALIB_CACHE_DIR, `klines-${symbol}-${interval}.json`);
}

function readCache(symbol: string, interval: string, want: number): CacheFile | null {
  const p = cachePath(symbol, interval);
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as CacheFile;
    if (!Array.isArray(raw.klines) || raw.klines.length < Math.min(want, 200)) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeCache(file: CacheFile): void {
  mkdirSync(CALIB_CACHE_DIR, { recursive: true });
  writeFileSync(cachePath(file.symbol, file.interval), JSON.stringify(file));
}

async function fetchPage(host: string, symbol: string, interval: string, endTime?: number): Promise<Kline[]> {
  const q = new URLSearchParams({ symbol, interval, limit: "1000" });
  if (endTime != null) q.set("endTime", String(endTime));
  const { json } = await fetchJson(`${host}/api/v3/klines?${q.toString()}`);
  if (isGeoBlocked(json)) throw new Error(`geo-blocked at ${host}`);
  return parseKlines(json);
}

async function paginate(symbol: string, interval: string, want: number): Promise<{ klines: Kline[]; host: string }> {
  const errors: string[] = [];
  for (const host of SPOT_REST_HOSTS) {
    try {
      const byTime = new Map<number, Kline>();
      let endTime: number | undefined;
      for (let page = 0; page < 4 && byTime.size < want; page++) {
        const batch = await fetchPage(host, symbol, interval, endTime);
        if (batch.length === 0) break;
        for (const k of batch) byTime.set(k.openTime, k);
        const oldest = batch[0];
        if (!oldest) break;
        endTime = oldest.openTime - 1;
        if (batch.length < 50) break;
      }
      const klines = [...byTime.values()].sort((a, b) => a.openTime - b.openTime);
      if (klines.length < 200) throw new Error(`${host}: only ${klines.length} bars`);
      return { klines, host };
    } catch (err) {
      errors.push(`${host}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(errors.join(" | "));
}

export async function loadCalibrationKlines(
  symbol = CALIB_SYMBOL,
  interval = CALIB_INTERVAL,
  want = CALIB_BARS,
): Promise<{ klines: Kline[]; source: DataSource }> {
  const cached = readCache(symbol, interval, want);
  const fresh = cached && Date.now() - cached.fetchedAt < CALIB_CACHE_TTL_MS;
  if (cached && fresh) {
    return {
      klines: cached.klines,
      source: { kind: "rest", host: cached.host, note: `cache hit ${cached.klines.length} bars` },
    };
  }
  try {
    const { klines, host } = await paginate(symbol, interval, want);
    writeCache({ symbol, interval, fetchedAt: Date.now(), host, klines });
    return { klines, source: { kind: "rest", host, note: `${klines.length} × ${interval}` } };
  } catch (err) {
    if (cached) {
      return {
        klines: cached.klines,
        source: {
          kind: "rest",
          host: cached.host,
          note: `stale cache after fetch miss (${err instanceof Error ? err.message : String(err)})`,
        },
      };
    }
    const klines = makeFixtureKlines();
    return {
      klines,
      source: {
        kind: "fixture",
        note: `public REST unreachable (${err instanceof Error ? err.message : String(err)}); synthetic ${klines.length} BTC-like 1h bars`,
      },
    };
  }
}
