#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DESK_VERSION } from "./config.js";
import { banner, fundingPct, pct, usd } from "./format.js";
import { mcpStatus } from "./mcp/client.js";
import { printDemo } from "./workflows/demo.js";
import { runDataWorkflow } from "./workflows/data.js";
import { riskFooter, runSignalWorkflow } from "./workflows/trading.js";
import { runPaymentWorkflow } from "./workflows/payments.js";
import { runOnchainWorkflow } from "./workflows/onchain.js";

function usage(): string {
  return `${banner("DESK", "analysis → signal → agent payment → onchain intent")}
Usage:
  desk demo          Run all four Track A workflows (judge path)
  desk brief         Data & Analysis only
  desk signal        Trading signal + dry-run executor
  desk pay           B402 bazaar + local x402 settlement
  desk chain         Onchain inspect + DeFi intent (dry-run)
  desk mcp-status    Probe Binance MCP without crashing if OAuth is missing

Flags:
  --confirm          Required together with DESK_LIVE=1 to attempt a live send
  --json             Machine-readable stdout

Env:
  DESK_LIVE=1        Opt in to live MCP send (still needs --confirm AND a bound trade tool)
  DESK_MCP_TOKEN     Optional bearer from an already-completed OAuth session
  DESK_MCP_URL       Default https://agent.binance.com/mcp/agentic

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
      return printDemo();
    case "brief": {
      const data = await runDataWorkflow();
      emit(data, asJson, () => {
        const lines = [banner("DESK brief", "Data & Analysis")];
        for (const row of data.rows) {
          lines.push(
            `${row.symbol}  last ${usd(row.ticker.lastPrice)}  24h ${pct(row.ticker.priceChangePercent)}  imb ${row.book.imbalance.toFixed(3)}  fund ${row.funding ? fundingPct(row.funding.lastFundingRate) : "n/a"}  src ${row.source.host ?? row.source.kind}`,
          );
        }
        lines.push(
          `portfolio $${usd(data.portfolio.totalUsd)}  ${data.portfolio.concentration}`,
        );
        return lines.join("\n");
      });
      return 0;
    }
    case "signal": {
      const out = await runSignalWorkflow("BTCUSDT");
      emit(out, asJson, () =>
        [
          banner("DESK signal", "Trading Workflows"),
          `${out.signal.symbol}  ${out.signal.side}  conf ${(out.signal.confidence * 100).toFixed(0)}%`,
          out.signal.rationale,
          `size $${usd(out.signal.suggestedSize.quoteUsd)}  ${out.execution.mode}`,
          out.execution.note,
          Object.keys(out.execution.payload).length
            ? JSON.stringify(out.execution.payload, null, 2)
            : "",
          riskFooter(),
        ]
          .filter(Boolean)
          .join("\n"),
      );
      return 0;
    }
    case "pay": {
      const pay = await runPaymentWorkflow();
      emit(pay, asJson, () =>
        [
          banner("DESK pay", "Payment Workflows · B402 / x402"),
          `bazaar ${pay.listed}  pick ${pay.picked?.resource ?? "none"}`,
          ...pay.trace.map((s) => `${s.status}  ${s.title} — ${s.detail}`),
          `receipt ${pay.receipt.txHash}  chain ${pay.receipt.chainId}`,
        ].join("\n"),
      );
      return 0;
    }
    case "chain": {
      const onchain = await runOnchainWorkflow();
      emit(onchain, asJson, () =>
        [
          banner("DESK chain", "Onchain Workflows · Skills Hub"),
          `${onchain.token.symbol}  ${onchain.token.contractAddress}`,
          `audit ${onchain.audit.riskLevelEnum ?? "n/a"}`,
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
