import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { main } from "../src/cli.js";
import { formatDemoReport } from "../src/report.js";
import { executeSignal, minNotionalBuy } from "../src/workflows/trading.js";
import { parseSpotFilters } from "../src/market/filters.js";
import { FIXTURE_EXCHANGE_INFO } from "../src/market/fixtures.js";
import { buildChecklist } from "../src/checklist.js";
import { parseConfirms } from "../src/confirms.js";
import { merchantRespond, merchantRequirement, demoPaymentSignature } from "../src/payments/merchant.js";
import type { AlphaReport, DemoReport } from "../src/types.js";

function sampleReport(): AlphaReport {
  return {
    symbol: "BNBUSDT",
    row: {
      symbol: "BNBUSDT",
      ticker: {
        symbol: "BNBUSDT",
        lastPrice: 680,
        bidPrice: 679.9,
        askPrice: 680,
        priceChangePercent: -1.6,
        volume: 1,
        quoteVolume: 1,
        highPrice: 700,
        lowPrice: 670,
      },
      book: { imbalance: 0.2, bidQty: 1, askQty: 0.8, mid: 680, spreadBps: 1 },
      klines: [],
      funding: {
        symbol: "BNBUSDT",
        markPrice: 680,
        indexPrice: 680,
        lastFundingRate: 0.00004,
        nextFundingTime: 1,
      },
      levels: { support: 670, resistance: 700, last: 680, distToSupportPct: 1, distToResistancePct: 3 },
      source: { kind: "rest", host: "data-api.binance.vision" },
    },
    filters: {
      symbol: "BNBUSDT",
      minNotional: 5,
      minQty: 0.001,
      stepSize: 0.001,
      source: { kind: "rest" },
    },
    token: { chainId: "56", contractAddress: "0xbb4", symbol: "WBNB", source: { kind: "skills-hub" } },
    audit: {
      hasResult: true,
      isSupported: true,
      riskLevelEnum: "MID",
      riskLevel: 3,
      hits: [],
      honeypot: false,
      source: { kind: "skills-hub" },
    },
    skillSignal: { stub: true, summary: "stub", source: { kind: "fixture" } },
    portfolio: {
      source: { kind: "fixture" },
      balances: [{ asset: "USDT", free: 20, locked: 0 }],
      totalUsd: 20,
      usdtFree: 20,
      weights: [{ asset: "USDT", usd: 20, weightPct: 100 }],
      estimatedPnl24hUsd: 0,
      concentration: "USDT",
      notes: [],
    },
  };
}

describe("CLI demo", () => {
  it("desk demo exits 0 and prints the ScoutPay loop", { timeout: 90_000 }, async () => {
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
    assert.match(out, /Alpha Report/);
    assert.match(out, /402/);
    assert.match(out, /SPOT MARKET/);
    assert.match(out, /Earn deposit/);
    assert.match(out, /CHECKLIST/);
    assert.match(out, /BNBUSDT/);
    assert.match(out, /--confirm-pay/);
    assert.match(out, /github.com\/xhrissboost\/agent-os-desk/);
  });

  it("live send is refused without MCP even with flags", () => {
    const signal = minNotionalBuy(sampleReport());
    const result = executeSignal(signal, { liveRequested: true, confirm: true });
    assert.equal(result.mode, "live-blocked-no-mcp");
    assert.equal(signal.side, "BUY");
    assert.equal(signal.suggestedSize.quoteUsd, 5);
  });

  it("formatter emits loop sections + checklist", () => {
    const report = {
      generatedAt: "2026-09-01T00:00:00.000Z",
      loop: "ScoutPay",
      symbol: "BNBUSDT",
      mcp: {
        endpoint: "https://agent.binance.com/mcp/agentic",
        reachable: false,
        authenticated: false,
        tools: [],
        capabilities: { market: false, account: false, trade: false, transfer: false },
        note: "test",
      },
      confirms: { pay: false, spot: false, defi: false },
      checklist: {
        items: [
          { id: "major-pair", ok: true, gate: true, label: "major CEX pair only", detail: "BNBUSDT" },
        ],
        hardPass: false,
        liveBlocked: false,
      },
      data: sampleReport(),
      trading: {
        signal: minNotionalBuy(sampleReport()),
        execution: { mode: "waiting-confirm", payload: {}, note: "test" },
      },
      payments: {
        rail: "merchant",
        bazaarSource: { kind: "fixture" },
        listed: 0,
        cheapListings: 0,
        picked: null,
        requirement: merchantRequirement(),
        amountUsd: 0.25,
        readyToSign: true,
        signatureHeader: "x",
        memo: { title: "memo", body: "body", symbol: "BNBUSDT" },
        trace: [],
        receipt: {
          settlement: "merchant",
          chainId: 97,
          network: "eip155:97",
          payer: "Desk",
          payee: "Counterparty",
          amount: "250000",
          amountUsd: 0.25,
          asset: "0x",
          txHash: "0x" + "ab".repeat(32),
          settledAt: "2026-09-01T00:00:00.000Z",
          resource: "desk://counterparty/alpha-memo",
        },
      },
      onchain: {
        token: { chainId: "56", contractAddress: "0x", source: { kind: "fixture" } },
        audit: { hasResult: false, isSupported: false, hits: [], honeypot: false, source: { kind: "fixture" } },
        intent: {
          action: "earn-deposit",
          chain: "bsc-testnet",
          chainId: 97,
          dryRun: true,
          walletSkillInstalled: false,
          amountUsdt: 1,
          summary: "test",
          bawCommand: "baw defi preview",
          note: "test",
        },
        adapters: ["query-token-info"],
      },
    } satisfies DemoReport;
    const text = formatDemoReport(report);
    assert.match(text, /Alpha Report/);
    assert.match(text, /402 → Alpha Memo/);
    assert.match(text, /SPOT MARKET/);
    assert.match(text, /Earn deposit INTENT/);
    assert.match(text, /CHECKLIST/);
  });
});

describe("exchangeInfo min notional", () => {
  it("parses NOTIONAL from exchangeInfo and does not hardcode 5 forever", () => {
    const f = parseSpotFilters(FIXTURE_EXCHANGE_INFO, "BNBUSDT", { kind: "fixture" });
    assert.equal(f.minNotional, 5);
    assert.equal(f.stepSize, 0.001);
  });
});

describe("checklist fail-closed", () => {
  it("rejects meme pairs and missing confirms", () => {
    const payment = {
      rail: "merchant" as const,
      bazaarSource: { kind: "merchant" as const },
      listed: 0,
      cheapListings: 0,
      picked: null,
      requirement: merchantRequirement(),
      amountUsd: 0.25,
      readyToSign: true,
      signatureHeader: "x",
      memo: null,
      trace: [],
      receipt: null,
    };
    const meme = sampleReport();
    meme.symbol = "MEMEUSDT";
    meme.row.symbol = "MEMEUSDT";
    const c = buildChecklist({
      symbol: "MEMEUSDT",
      report: meme,
      payment,
      confirms: { pay: false, spot: false, defi: false },
      live: false,
    });
    assert.equal(c.items.find((i) => i.id === "major-pair")?.ok, false);
    assert.equal(c.items.find((i) => i.id === "confirm-pay")?.ok, false);
    assert.equal(c.hardPass, false);
  });

  it("rejects HIGH / honeypot audits and ignores a bare --confirm", () => {
    const payment = {
      rail: "merchant" as const,
      bazaarSource: { kind: "merchant" as const },
      listed: 0,
      cheapListings: 0,
      picked: null,
      requirement: merchantRequirement(),
      amountUsd: 0.25,
      readyToSign: true,
      signatureHeader: "x",
      memo: null,
      trace: [],
      receipt: null,
    };
    const high = sampleReport();
    high.audit.riskLevelEnum = "HIGH";
    high.audit.riskLevel = 4;
    const cHigh = buildChecklist({
      symbol: "BNBUSDT",
      report: high,
      payment,
      confirms: { pay: true, spot: true, defi: true },
      live: false,
    });
    assert.equal(cHigh.items.find((i) => i.id === "audit")?.ok, false);
    assert.equal(cHigh.hardPass, false);

    const honey = sampleReport();
    honey.audit.honeypot = true;
    const cHoney = buildChecklist({
      symbol: "BNBUSDT",
      report: honey,
      payment,
      confirms: { pay: true, spot: true, defi: true },
      live: false,
    });
    assert.equal(cHoney.items.find((i) => i.id === "audit")?.ok, false);

    const ignored = parseConfirms(["demo", "--confirm"]);
    assert.deepEqual(ignored, { pay: false, spot: false, defi: false });
    const named = parseConfirms(["demo", "--confirm-pay", "--confirm-spot", "--confirm-defi"]);
    assert.deepEqual(named, { pay: true, spot: true, defi: true });
  });
});

describe("local x402 merchant", () => {
  it("returns 402 without signature and the memo after PAYMENT-SIGNATURE", () => {
    const req = merchantRequirement();
    const closed = merchantRespond(undefined, { title: "m", body: "b", symbol: "BNBUSDT" });
    assert.equal(closed.status, 402);
    const sig = demoPaymentSignature(req);
    const open = merchantRespond(sig, { title: "Alpha", body: "BNB", symbol: "BNBUSDT" });
    assert.equal(open.status, 200);
    assert.equal(open.memo?.title, "Alpha");
    const usd = Number(req.accepts[0]!.extra.amountUsd);
    assert.ok(usd <= 1);
    assert.ok(usd > 0);
  });
});
