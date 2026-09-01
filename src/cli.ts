#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DESK_VERSION, DEFAULT_SYMBOL, LOOP_NICKNAME } from "./config.js";
import { banner, fundingPct, pct, usd } from "./format.js";
import { mcpStatus } from "./mcp/client.js";
import { printDemo } from "./workflows/demo.js";
import { runAlphaReport } from "./workflows/data.js";
import { formatCalibrationAnsi, writeCalibrationArtifacts } from "./calibration/heatmap.js";
import { riskFooter, runSignalWorkflow } from "./workflows/trading.js";
import { runPaymentWorkflow } from "./workflows/payments.js";
import { runOnchainWorkflow } from "./workflows/onchain.js";

function usage(): string {
  return `${banner("DESK", `${LOOP_NICKNAME} · pay-for-alpha treasury loop`)}
Usage:
  desk demo          ScoutPay loop (judge path): BTC calibration → 402 memo → min-notional SPOT → Earn intent
  desk brief         BTC calibration heatmap + BNBUSDT ticker (Data)
  desk signal        Restated BNBUSDT SPOT MARKET min-notional ticket
  desk pay           x402 v2 merchant 402 → PAYMENT-SIGNATURE → gated memo
  desk chain         DeFi Earn deposit INTENT (1–5 USDT leftover)
  desk mcp-status    Probe Binance MCP without crashing if OAuth is missing

Confirms (never skipped; a bare --confirm does nothing):
  --confirm-pay      operator confirms the x402 payment
  --confirm-spot     operator confirms the SPOT MARKET ticket
  --confirm-defi     operator confirms the Earn deposit intent

Flags:
  --json             Machine-readable stdout

Env:
  DESK_LIVE=1        Opt in to live MCP send (still needs --confirm-spot AND a bound trade tool)
  DESK_MCP_TOKEN     Optional bearer from an already-completed OAuth session
  DESK_MCP_URL       Default https://agent.binance.com/mcp/agentic

Track B is a separate first-10k race (spot + futures + convert, ~80 USDT in the Agentic sub).
This repo does not execute Track B trades.

v${DESK_VERSION}  ·  Node 22+  ·  no API keys for the demo
`;
}

function jsonMode(argv: string[]): boolean {
  return argv.includes("--json");
}

function emit(value: unknown, asJson: boolean, text: () => string): void {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${text()}\n`);
}

async function main(argv: string[]): Promise<number> {
  const cmd = argv[0] && !argv[0].startsWith("-") ? argv[0] : "help";
  const asJson = jsonMode(argv);

  switch (cmd) {
    case "help":
    case "-h":
    case "--help":
      process.stdout.write(usage());
      return 0;
    case "version":
    case "--version":
      process.stdout.write(`${DESK_VERSION}\n`);
      return 0;
    case "demo":
      return printDemo(argv);
    case "brief": {
      const data = await runAlphaReport(DEFAULT_SYMBOL);
      try {
        writeCalibrationArtifacts(data.calibration);
      } catch {
        /* artifacts are best-effort for the film path */
      }
      emit(data, asJson, () => {
        const row = data.row;
        const cal = data.calibration;
        return [
          banner("DESK brief", "BTC calibration · Alpha Report"),
          formatCalibrationAnsi(cal, { full: true }),
          "",
          `${row.symbol}  last ${usd(row.ticker.lastPrice)}  24h ${pct(row.ticker.priceChangePercent)}  imb ${row.book.imbalance.toFixed(3)}  fund ${row.funding ? fundingPct(row.funding.lastFundingRate) : "n/a"}  src ${row.source.host ?? row.source.kind}`,
          `minNotional ${data.filters.minNotional} USDT`,
          `audit ${data.audit.riskLevelEnum ?? "n/a"}  ${data.skillSignal.summary}`,
        ].join("\n");
      });
      return 0;
    }
    case "signal": {
      const out = await runSignalWorkflow(DEFAULT_SYMBOL);
      emit(out, asJson, () =>
        [
          banner("DESK signal", "SPOT MARKET min-notional"),
          `${out.signal.symbol}  ${out.signal.side}  quoteOrderQty ${out.signal.suggestedSize.quoteUsd}`,
          out.signal.rationale,
          out.execution.mode,
          out.execution.note,
          Object.keys(out.execution.payload).length ? JSON.stringify(out.execution.payload, null, 2) : "",
          riskFooter(),
        ]
          .filter(Boolean)
          .join("\n"),
      );
      return 0;
    }
    case "pay": {
      const report = await runAlphaReport(DEFAULT_SYMBOL);
      const pay = await runPaymentWorkflow(report);
      emit(pay, asJson, () =>
        [
          banner("DESK pay", "x402 v2 merchant"),
          `amount $${pay.amountUsd.toFixed(2)}  READY_TO_SIGN=${pay.readyToSign}  rail=${pay.rail}`,
          ...pay.trace.map((s) => `${s.status}  ${s.title} — ${s.detail}`),
          pay.memo ? `memo ${pay.memo.title}` : "",
          pay.receipt ? `receipt ${pay.receipt.txHash}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      return 0;
    }
    case "chain": {
      const onchain = await runOnchainWorkflow();
      emit(onchain, asJson, () =>
        [
          banner("DESK chain", "DeFi Earn deposit INTENT"),
          `${onchain.intent.amountUsdt} USDT  ${onchain.intent.action}`,
          onchain.intent.summary,
          onchain.intent.bawCommand,
          onchain.intent.note,
        ].join("\n"),
      );
      return 0;
    }
    case "mcp-status": {
      const status = await mcpStatus();
      emit(status, asJson, () =>
        [
          banner("DESK mcp-status"),
          status.endpoint,
          `reachable=${status.reachable} authenticated=${status.authenticated}`,
          status.note,
          `tools: ${status.tools.length ? status.tools.join(", ") : "(none discovered)"}`,
          `caps: market=${status.capabilities.market} account=${status.capabilities.account} trade=${status.capabilities.trade} transfer=${status.capabilities.transfer}`,
        ].join("\n"),
      );
      return 0;
    }
    default:
      process.stderr.write(`unknown command: ${cmd}\n\n${usage()}`);
      return 1;
  }
}

const isDirectRun = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(resolve(entry)).href;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err: unknown) => {
      process.stderr.write(`desk: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    });
}

export { main };
