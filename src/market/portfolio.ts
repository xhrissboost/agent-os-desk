import { SAMPLE_PORTFOLIO } from "../config.js";
import { num } from "../http.js";
import { parseBalances } from "./parse.js";
import type { Balance, DataSource, MarketRow, PortfolioInsight } from "../types.js";

function pricesFromRows(rows: MarketRow[]): Map<string, { usd: number; changePct: number }> {
  const map = new Map<string, { usd: number; changePct: number }>();
  map.set("USDT", { usd: 1, changePct: 0 });
  map.set("USDC", { usd: 1, changePct: 0 });
  map.set("FDUSD", { usd: 1, changePct: 0 });
  for (const row of rows) {
    const base = row.symbol.replace(/USDT$|USDC$|FDUSD$|BUSD$/, "");
    map.set(base, { usd: row.ticker.lastPrice, changePct: row.ticker.priceChangePercent });
  }
  return map;
}

function toBalances(
  raw: ReadonlyArray<{ asset: string; free: string; locked: string }>,
): Balance[] {
  return raw.map((b) => ({
    asset: b.asset,
    free: num(b.free),
    locked: num(b.locked),
  }));
}

export function samplePortfolioInsight(rows: MarketRow[]): PortfolioInsight {
  return buildPortfolioInsight(
    toBalances(SAMPLE_PORTFOLIO),
    rows,
    { kind: "fixture", note: "sample book — MCP account not connected" },
  );
}

export function livePortfolioInsight(
  raw: unknown,
  rows: MarketRow[],
  source: DataSource,
): PortfolioInsight {
  const parsed = parseBalances(raw);
  if (parsed.length === 0) return samplePortfolioInsight(rows);
  return buildPortfolioInsight(toBalances(parsed), rows, source);
}

export function buildPortfolioInsight(
  balances: Balance[],
  rows: MarketRow[],
  source: DataSource,
): PortfolioInsight {
  const px = pricesFromRows(rows);
  const valued = balances
    .map((b) => {
      const qty = b.free + b.locked;
      const quote = px.get(b.asset) ?? (b.asset.endsWith("USD") ? { usd: 1, changePct: 0 } : null);
      if (!quote || qty === 0) return null;
      const usd = qty * quote.usd;
      return { asset: b.asset, usd, qty, changePct: quote.changePct };
    })
    .filter((x): x is { asset: string; usd: number; qty: number; changePct: number } => x !== null);

  const totalUsd = valued.reduce((s, v) => s + v.usd, 0);
  const weights = valued
    .map((v) => ({
      asset: v.asset,
      usd: v.usd,
      weightPct: totalUsd ? (v.usd / totalUsd) * 100 : 0,
    }))
    .sort((a, b) => b.usd - a.usd);

  const estimatedPnl24hUsd = valued.reduce((s, v) => s + v.usd * (v.changePct / 100), 0);
  const top = weights[0];
  const concentration =
    top && top.weightPct >= 60
      ? `${top.asset} is ${top.weightPct.toFixed(1)}% of the book — single-name risk`
      : top
        ? `largest weight ${top.asset} ${top.weightPct.toFixed(1)}%`
        : "empty book";

  const notes: string[] = [];
  if (estimatedPnl24hUsd < 0) {
    notes.push("24h mark-to-market is negative; size any fade against cash, not against the hole.");
  } else {
    notes.push("24h mark-to-market is positive; do not let the print raise max size.");
  }
  const cash = weights.find((w) => w.asset === "USDT" || w.asset === "USDC");
  if (cash && cash.weightPct < 15) {
    notes.push("stablecoin buffer under 15% — dry-run only until cash is rebuilt.");
  }
  notes.push("Agent cannot withdraw and cannot pull from the main account. Writes stay confirm-first.");

  return {
    source,
    balances,
    totalUsd,
    weights,
    estimatedPnl24hUsd,
    concentration,
    notes,
  };
}
