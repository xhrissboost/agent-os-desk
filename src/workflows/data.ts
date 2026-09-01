import { DEFAULT_SYMBOLS } from "../config.js";
import { BinanceMcpClient } from "../mcp/client.js";
import { fetchDepth, fetchFunding, fetchKlines, fetchTicker } from "../market/rest.js";
import { bookLevels, supportResistance } from "../market/levels.js";
import { samplePortfolioInsight } from "../market/portfolio.js";
import type { MarketRow, PortfolioInsight } from "../types.js";

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

export async function runDataWorkflow(
  symbols: readonly string[] = DEFAULT_SYMBOLS,
): Promise<{ rows: MarketRow[]; portfolio: PortfolioInsight }> {
  const rows = await Promise.all(symbols.map((s) => loadMarketRow(s)));
  const mcp = new BinanceMcpClient();
  const status = await mcp.status();
  const portfolio = samplePortfolioInsight(rows);
  if (status.authenticated && status.capabilities.account) {
    portfolio.source = {
      kind: "mcp",
      note: "account capability present but no tool name is assumed; sample book until bind",
    };
  }
  return { rows, portfolio };
}
