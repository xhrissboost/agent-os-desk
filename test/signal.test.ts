import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeSignal, scoreRaw, sideFromScore } from "../src/workflows/trading.js";

describe("signal math", () => {
  it("fades crowded longs: +funding and bid-heavy book → SELL", () => {
    const raw = scoreRaw(0.0008, 0.6);
    assert.ok(raw < 0, `expected negative raw, got ${raw}`);
    const signal = computeSignal({
      symbol: "BTCUSDT",
      lastPrice: 80_000,
      fundingRate: 0.0008,
      imbalance: 0.6,
      change24hPct: 2,
      portfolioUsd: 20_000,
    });
    assert.equal(signal.side, "SELL");
    assert.ok(signal.confidence >= 0.38);
    assert.equal(signal.suggestedSize.maxNotionalUsd, 250);
    assert.ok(signal.suggestedSize.quoteUsd <= 250);
    assert.ok(signal.suggestedSize.quoteUsd <= 20_000 * 0.05);
  });

  it("fades crowded shorts: −funding and ask-heavy book → BUY", () => {
    const signal = computeSignal({
      symbol: "SOLUSDT",
      lastPrice: 200,
      fundingRate: -0.0007,
      imbalance: -0.55,
      change24hPct: -1.2,
      portfolioUsd: 20_000,
    });
    assert.equal(signal.side, "BUY");
    assert.ok(signal.confidence >= 0.38);
    assert.match(signal.rationale, /shorts/);
  });

  it("holds when the score is inside the deadband", () => {
    assert.equal(sideFromScore(0.02), "HOLD");
    const signal = computeSignal({
      symbol: "ETHUSDT",
      lastPrice: 4000,
      fundingRate: 0.00001,
      imbalance: 0.02,
      change24hPct: 0.1,
      portfolioUsd: 20_000,
    });
    assert.equal(signal.side, "HOLD");
  });

  it("hard-skips pathological funding", () => {
    const signal = computeSignal({
      symbol: "BTCUSDT",
      lastPrice: 80_000,
      fundingRate: 0.2,
      imbalance: 0.9,
      change24hPct: 12,
      portfolioUsd: 20_000,
    });
    assert.equal(signal.side, "HOLD");
    assert.equal(signal.risk.skipped, true);
    assert.equal(signal.confidence, 0);
    assert.match(signal.rationale, /hard cap/);
  });

  it("caps size by the smaller of notional and book percentage", () => {
    const tinyBook = computeSignal({
      symbol: "BTCUSDT",
      lastPrice: 70_000,
      fundingRate: 0.0008,
      imbalance: 0.7,
      change24hPct: 0,
      portfolioUsd: 1_000,
    });
    assert.ok(tinyBook.suggestedSize.quoteUsd <= 50.01);
    assert.match(tinyBook.suggestedSize.cappedBy, /portfolio/);
  });
});
