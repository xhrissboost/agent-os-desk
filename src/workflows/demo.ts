import {
  DEFAULT_SYMBOL,
  EARN_DEPOSIT_MAX_USDT,
  EARN_DEPOSIT_MIN_USDT,
  MEMO_PRICE_USD,
} from "../config.js";
import { iso } from "../format.js";
import { mcpStatus } from "../mcp/client.js";
import { parseConfirms, liveRequested } from "../confirms.js";
import { buildChecklist } from "../checklist.js";
import { formatDemoReport } from "../report.js";
import { writeCalibrationArtifacts } from "../calibration/heatmap.js";
import { runAlphaReport } from "./data.js";
import { executeSpotBuy, minNotionalBuy } from "./trading.js";
import { runPaymentWorkflow } from "./payments.js";
import { runOnchainWorkflow } from "./onchain.js";
import type { DemoReport } from "../types.js";

export async function runDemo(argv: string[] = process.argv): Promise<DemoReport> {
  const symbol = DEFAULT_SYMBOL;
  const confirms = parseConfirms(argv);
  const live = liveRequested();
  const mcp = await mcpStatus();

  const data = await runAlphaReport(symbol);
  const payments = await runPaymentWorkflow(data);
  const checklist = buildChecklist({ symbol, report: data, payment: payments, confirms, live });

  const signal = minNotionalBuy(data);
  const execution = executeSpotBuy(signal, {
    liveRequested: live,
    confirmSpot: confirms.spot,
    checklist,
    mcpTradeBound: mcp.authenticated && mcp.capabilities.trade,
  });

  const leftover = Math.min(
    EARN_DEPOSIT_MAX_USDT,
    Math.max(EARN_DEPOSIT_MIN_USDT, data.portfolio.usdtFree - MEMO_PRICE_USD - signal.suggestedSize.quoteUsd),
  );
  const onchain = await runOnchainWorkflow(leftover);
  if (!confirms.defi) {
    onchain.intent.note = `${onchain.intent.note} WAITING --confirm-defi (never skipped).`;
  }

  return {
    generatedAt: iso(),
    loop: "ScoutPay",
    symbol,
    mcp,
    confirms,
    checklist,
    data,
    payments,
    trading: { signal, execution },
    onchain,
  };
}

export async function printDemo(argv: string[] = process.argv): Promise<number> {
  const report = await runDemo(argv);
  try {
    writeCalibrationArtifacts(report.data.calibration);
  } catch {
    /* artifacts are best-effort for the film path */
  }
  process.stdout.write(`${formatDemoReport(report)}\n`);
  return 0;
}
