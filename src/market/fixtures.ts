/**
 * Recorded public-REST snapshots so parsers and the offline path stay deterministic.
 * Live demo prefers api.binance.com → data-api.binance.vision → www.binance.com.
 */
export const FIXTURE_TICKER: Record<string, unknown> = {
  BNBUSDT: {
    symbol: "BNBUSDT",
    priceChangePercent: "-1.641",
    lastPrice: "680.81000000",
    bidPrice: "680.80000000",
    askPrice: "680.81000000",
    volume: "412000.4",
    quoteVolume: "290140000",
    highPrice: "698.10",
    lowPrice: "672.20",
  },
  BTCUSDT: {
    symbol: "BTCUSDT",
    priceChange: "-1804.47000000",
    priceChangePercent: "-2.285",
    lastPrice: "77182.67000000",
    bidPrice: "77182.66000000",
    askPrice: "77182.67000000",
    volume: "18420.12",
    quoteVolume: "1442500000",
    highPrice: "79880.00",
    lowPrice: "76840.00",
  },
  ETHUSDT: {
    symbol: "ETHUSDT",
    priceChangePercent: "-1.940",
    lastPrice: "3872.15000000",
    bidPrice: "3872.14000000",
    askPrice: "3872.15000000",
    volume: "220140.4",
    quoteVolume: "860120000",
    highPrice: "4010.00",
    lowPrice: "3820.50",
  },
  SOLUSDT: {
    symbol: "SOLUSDT",
    priceChangePercent: "3.410",
    lastPrice: "198.42000000",
    bidPrice: "198.41000000",
    askPrice: "198.42000000",
    volume: "4120000",
    quoteVolume: "790140000",
    highPrice: "204.10",
    lowPrice: "188.20",
  },
};

export const FIXTURE_DEPTH: Record<string, unknown> = {
  BNBUSDT: {
    lastUpdateId: 1,
    bids: [
      ["680.80", "40"],
      ["680.70", "22"],
    ],
    asks: [
      ["680.81", "18"],
      ["680.90", "30"],
    ],
  },
  BTCUSDT: {
    lastUpdateId: 1,
    bids: [
      ["77182.66", "1.20"],
      ["77182.00", "0.80"],
      ["77180.50", "2.10"],
    ],
    asks: [
      ["77182.67", "0.40"],
      ["77183.10", "0.55"],
      ["77184.00", "0.90"],
    ],
  },
  ETHUSDT: {
    lastUpdateId: 1,
    bids: [
      ["3872.14", "40"],
      ["3871.00", "22"],
    ],
    asks: [
      ["3872.15", "55"],
      ["3873.00", "30"],
    ],
  },
  SOLUSDT: {
    lastUpdateId: 1,
    bids: [
      ["198.41", "800"],
      ["198.20", "400"],
    ],
    asks: [
      ["198.42", "1200"],
      ["198.60", "600"],
    ],
  },
};

function syntheticKlines(close: number, drift: number): unknown[] {
  const out: unknown[] = [];
  let c = close * (1 - drift);
  const t0 = 1_788_282_000_000;
  for (let i = 0; i < 24; i++) {
    const open = c;
    c = c * (1 + drift / 24);
    const high = Math.max(open, c) * 1.004;
    const low = Math.min(open, c) * 0.996;
    out.push([t0 + i * 3_600_000, open, high, low, c, 100 + i, t0 + (i + 1) * 3_600_000 - 1]);
  }
  return out;
}

export const FIXTURE_KLINES: Record<string, unknown> = {
  BNBUSDT: syntheticKlines(680.81, -0.016),
  BTCUSDT: syntheticKlines(77182.67, -0.02),
  ETHUSDT: syntheticKlines(3872.15, -0.018),
  SOLUSDT: syntheticKlines(198.42, 0.03),
};

export const FIXTURE_FUNDING: Record<string, unknown> = {
  BNBUSDT: {
    symbol: "BNBUSDT",
    markPrice: "680.50",
    indexPrice: "680.70",
    lastFundingRate: "0.00004100",
    nextFundingTime: 1_788_307_200_000,
  },
  BTCUSDT: {
    symbol: "BTCUSDT",
    markPrice: "77138.80",
    indexPrice: "77172.10",
    lastFundingRate: "0.00005073",
    nextFundingTime: 1_788_307_200_000,
  },
  ETHUSDT: {
    symbol: "ETHUSDT",
    markPrice: "3870.00",
    indexPrice: "3871.20",
    lastFundingRate: "0.00001200",
    nextFundingTime: 1_788_307_200_000,
  },
  SOLUSDT: {
    symbol: "SOLUSDT",
    markPrice: "198.50",
    indexPrice: "198.40",
    lastFundingRate: "-0.00018000",
    nextFundingTime: 1_788_307_200_000,
  },
};

export const GEO_BLOCK_BODY = {
  code: 0,
  msg: "Service unavailable from a restricted location according to 'b. Eligibility' in https://www.binance.com/en/terms.",
};

export const FIXTURE_EXCHANGE_INFO = {
  timezone: "UTC",
  symbols: [
    {
      symbol: "BNBUSDT",
      filters: [
        { filterType: "LOT_SIZE", minQty: "0.00100000", stepSize: "0.00100000" },
        {
          filterType: "NOTIONAL",
          minNotional: "5.00000000",
          applyMinToMarket: true,
          maxNotional: "9000000.00000000",
        },
      ],
    },
  ],
};
