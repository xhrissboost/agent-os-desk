import { DEFAULT_SYMBOL, WBNB_BSC, WEB3_API, WEB3_SKILL_UA } from "../config.js";
import { BinanceMcpClient } from "../mcp/client.js";
import { fetchDepth, fetchFunding, fetchKlines, fetchSpotFilters, fetchTicker } from "../market/rest.js";
import { bookLevels, supportResistance } from "../market/levels.js";
import { samplePortfolioInsight } from "../market/portfolio.js";
import { auditToken, inspectToken } from "../skills/hub.js";
import { asRecord, fetchJson, str } from "../http.js";
import type { AlphaReport, MarketRow, SkillSignal } from "../types.js";

export async function loadMarketRow(symbol: string): Promise<MarketRow> {
  const [tickerRes, depthRes, klineRes, fundingRes] = await Promise.all([
    fetchTicker(symbol),
    fetchDepth(symbol),
    fetchKlines(symbol),
    fetchFunding(symbol),
  ]);
  return {
    symbol,
    ticker: tickerRes.ticker,
    book: bookLevels(depthRes.book),
    klines: klineRes.klines,
    funding: fundingRes.funding,
    levels: supportResistance(klineRes.klines),
    source: {
      kind: tickerRes.source.kind,
      host: tickerRes.source.host ?? depthRes.source.host,
      note: [tickerRes.source.note, fundingRes.source.note].filter(Boolean).join("; ") || undefined,
    },
  };
}

async function loadSkillSignal(symbol: string): Promise<SkillSignal> {
  try {
    const { json, host } = await fetchJson(
      `${WEB3_API}/bapi/defi/v1/public/wallet-direct/buw/wallet/web/signal/smart-money/ai?page=1&pageSize=5`,
      { headers: { "user-agent": WEB3_SKILL_UA, "accept-encoding": "identity" } },
    );
    const rec = asRecord(json);
    const data = rec?.data;
    const list = Array.isArray(data) ? data : Array.isArray(asRecord(data)?.list) ? (asRecord(data)?.list as unknown[]) : [];
    const hit = list
      .map((x) => asRecord(x))
      .find((row) => row && str(row.symbol).toUpperCase().includes(symbol.replace("USDT", "")));
    if (!hit) {
      return {
        stub: true,
        summary: `trading-signal: no ${symbol} row in smart-money feed (honest empty).`,
        source: { kind: "skills-hub", host, note: "query returned no matching symbol" },
      };
    }
    return {
      stub: false,
      summary: `${str(hit.symbol, symbol)} smart-money ${str(hit.signal ?? hit.status, "n/a")}`,
      source: { kind: "skills-hub", host, note: "trading-signal HTTP adapter" },
    };
  } catch (err) {
    return {
      stub: true,
      summary: "trading-signal: HTTP adapter miss. Honest stub — no fabricated print.",
      source: { kind: "fixture", note: err instanceof Error ? err.message : String(err) },
    };
  }
}

export async function runAlphaReport(symbol = DEFAULT_SYMBOL): Promise<AlphaReport> {
  const [row, filters, token, skillSignal] = await Promise.all([
    loadMarketRow(symbol),
    fetchSpotFilters(symbol),
    inspectToken(symbol.startsWith("BNB") ? "WBNB" : symbol.replace("USDT", "")),
    loadSkillSignal(symbol),
  ]);
  const contract = token.contractAddress || WBNB_BSC;
  const audit = await auditToken(token.chainId || "56", contract);
  const mcp = new BinanceMcpClient();
  const status = await mcp.status();
  const portfolio = samplePortfolioInsight([row]);
  if (status.authenticated && status.capabilities.account) {
    portfolio.source = {
      kind: "mcp",
      note: "account capability present but no tool name is assumed; sample Agentic-sub book until bind. Never main-account.",
    };
  }
  return { symbol, row, filters, token, audit, skillSignal, portfolio };
}

/** CLI `brief` entry — same Alpha Report as the ScoutPay loop. */
export async function runDataWorkflow(symbols: readonly string[] = [DEFAULT_SYMBOL]): Promise<AlphaReport> {
  return runAlphaReport(symbols[0] ?? DEFAULT_SYMBOL);
}
