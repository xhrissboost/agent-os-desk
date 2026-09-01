import { iso } from "../format.js";
import { mcpStatus } from "../mcp/client.js";
import { runDataWorkflow } from "./data.js";
import { computeSignal, executeSignal } from "./trading.js";
import { runPaymentWorkflow } from "./payments.js";
import { runOnchainWorkflow } from "./onchain.js";
import { formatDemoReport } from "../report.js";
import type { DemoReport } from "../types.js";

export async function runDemo(): Promise<DemoReport> {
  const [mcp, data, payments, onchain] = await Promise.all([
    mcpStatus(),
    runDataWorkflow(),
    runPaymentWorkflow(),
    runOnchainWorkflow(),
  ]);

  const btc = data.rows.find((r) => r.symbol === "BTCUSDT") ?? data.rows[0]!;
  const signal = computeSignal({
    symbol: btc.symbol,
    lastPrice: btc.ticker.lastPrice,
    fundingRate: btc.funding?.lastFundingRate ?? 0,
    imbalance: btc.book.imbalance,
    change24hPct: btc.ticker.priceChangePercent,
    portfolioUsd: data.portfolio.totalUsd,
  });
  const execution = executeSignal(signal, {
    liveRequested: process.env.DESK_LIVE === "1",
    confirm: process.argv.includes("--confirm"),
  });

  return {
    generatedAt: iso(),
    mcp,
    data,
    trading: { signal, execution },
    payments,
    onchain,
  };
}

export async function printDemo(): Promise<number> {
  const report = await runDemo();
  process.stdout.write(`${formatDemoReport(report)}\n`);
  return 0;
}
