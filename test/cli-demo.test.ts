import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { main } from "../src/cli.js";
import { formatDemoReport } from "../src/report.js";
import { executeSignal, computeSignal } from "../src/workflows/trading.js";
import type { DemoReport } from "../src/types.js";

describe("CLI demo", () => {
  it("desk demo exits 0 and prints all four sections", { timeout: 90_000 }, async () => {
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stdout.write;
    try {
      const code = await main(["demo"]);
      assert.equal(code, 0);
    } finally {
      process.stdout.write = orig;
    }
    const out = chunks.join("");
    assert.match(out, /DATA & ANALYSIS/);
    assert.match(out, /TRADING WORKFLOWS/);
    assert.match(out, /PAYMENT WORKFLOWS/);
    assert.match(out, /ONCHAIN WORKFLOWS/);
    assert.match(out, /DRY-RUN|HOLD/);
    assert.match(out, /BTCUSDT/);
  });

  it("live send is refused without MCP even with flags", () => {
    const signal = computeSignal({
      symbol: "BTCUSDT",
      lastPrice: 80_000,
      fundingRate: 0.0008,
      imbalance: 0.7,
      change24hPct: 1,
      portfolioUsd: 20_000,
    });
    const result = executeSignal(signal, { liveRequested: true, confirm: true });
    assert.equal(result.mode, "live-blocked-no-mcp");
  });

  it("formatter always emits four headings", () => {
    const report = {
      generatedAt: "2026-09-01T00:00:00.000Z",
      mcp: {
        endpoint: "https://agent.binance.com/mcp/agentic",
        reachable: false,
        authenticated: false,
        tools: [],
        capabilities: { market: false, account: false, trade: false, transfer: false },
        note: "test",
      },
      data: {
        rows: [],
        portfolio: {
          source: { kind: "fixture" },
          balances: [],
          totalUsd: 0,
          weights: [],
          estimatedPnl24hUsd: 0,
          concentration: "empty",
          notes: [],
        },
      },
      trading: {
        signal: computeSignal({
          symbol: "BTCUSDT",
          lastPrice: 1,
          fundingRate: 0,
          imbalance: 0,
          change24hPct: 0,
          portfolioUsd: 100,
        }),
        execution: { mode: "dry-run", payload: {}, note: "test" },
      },
      payments: {
        bazaarSource: { kind: "fixture" },
        listed: 0,
        picked: null,
        requirement: {
          x402Version: 2,
          error: "x",
          resource: { url: "https://example.invalid", description: "x", mimeType: "application/json" },
          accepts: [],
          extensions: {},
        },
        trace: [],
        receipt: {
          settlement: "mock",
          chainId: 97,
          network: "eip155:97",
          payer: "Desk",
          payee: "Counterparty",
          amount: "0",
          asset: "0x",
          txHash: "0x" + "ab".repeat(32),
          settledAt: "2026-09-01T00:00:00.000Z",
          resource: "https://example.invalid",
        },
      },
      onchain: {
        token: { chainId: "56", contractAddress: "0x", source: { kind: "fixture" } },
        audit: { hasResult: false, isSupported: false, hits: [], source: { kind: "fixture" } },
        intent: {
          action: "lp-add",
          chain: "bsc-testnet",
          chainId: 97,
          dryRun: true,
          walletSkillInstalled: false,
          summary: "test",
          bawCommand: "baw defi preview",
          note: "test",
        },
        adapters: ["query-token-info"],
      },
    } satisfies DemoReport;
    const text = formatDemoReport(report);
    assert.match(text, /1\. DATA & ANALYSIS/);
    assert.match(text, /2\. TRADING WORKFLOWS/);
    assert.match(text, /3\. PAYMENT WORKFLOWS/);
    assert.match(text, /4\. ONCHAIN WORKFLOWS/);
  });
});
