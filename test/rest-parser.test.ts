import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseDepth,
  parseKlines,
  parsePremiumIndex,
  parseTicker24h,
} from "../src/market/parse.js";
import { bookLevels, supportResistance } from "../src/market/levels.js";
import { isGeoBlocked } from "../src/http.js";
import {
  FIXTURE_DEPTH,
  FIXTURE_FUNDING,
  FIXTURE_KLINES,
  FIXTURE_TICKER,
  GEO_BLOCK_BODY,
} from "../src/market/fixtures.js";

describe("REST parsers", () => {
  it("parses a 24h ticker", () => {
    const t = parseTicker24h(FIXTURE_TICKER.BTCUSDT, "BTCUSDT");
    assert.equal(t.symbol, "BTCUSDT");
    assert.equal(t.lastPrice, 77182.67);
    assert.equal(t.priceChangePercent, -2.285);
    assert.ok(t.bidPrice < t.askPrice || t.bidPrice === t.askPrice);
  });

  it("parses depth and book imbalance", () => {
    const book = parseDepth(FIXTURE_DEPTH.BTCUSDT, "BTCUSDT");
    const levels = bookLevels(book);
    assert.ok(levels.bidQty > levels.askQty);
    assert.ok(levels.imbalance > 0);
    assert.ok(levels.spreadBps >= 0);
  });

  it("parses klines and support/resistance", () => {
    const ks = parseKlines(FIXTURE_KLINES.BTCUSDT);
    assert.equal(ks.length, 24);
    const sr = supportResistance(ks);
    assert.ok(sr.support <= sr.last);
    assert.ok(sr.resistance >= sr.last);
  });

  it("parses premiumIndex funding", () => {
    const f = parsePremiumIndex(FIXTURE_FUNDING.BTCUSDT, "BTCUSDT");
    assert.equal(f.symbol, "BTCUSDT");
    assert.ok(Math.abs(f.lastFundingRate) < 0.01);
    assert.ok(f.nextFundingTime > 0);
  });

  it("detects geo-block bodies instead of treating them as tickers", () => {
    assert.equal(isGeoBlocked(GEO_BLOCK_BODY), true);
    assert.throws(() => parseTicker24h(GEO_BLOCK_BODY, "BTCUSDT"), /geo-blocked/);
  });

  it("rejects malformed kline payloads", () => {
    assert.throws(() => parseKlines({ nope: true }), /expected array/);
  });
});
