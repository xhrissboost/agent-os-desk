export const DESK_VERSION = "1.2.0";
export const LOOP_NICKNAME = "ScoutPay";
export const GITHUB_URL = "https://github.com/xhrissboost/agent-os-desk";

export const MCP_ENDPOINT =
  process.env.DESK_MCP_URL ?? "https://agent.binance.com/mcp/agentic";

/** Official public REST hosts, tried in order. */
export const SPOT_REST_HOSTS = [
  "https://api.binance.com",
  "https://data-api.binance.vision",
  "https://www.binance.com",
] as const;

export const FUTURES_REST_HOSTS = [
  "https://fapi.binance.com",
  "https://www.binance.com",
] as const;

export const B402_BAZAAR_BASE =
  "https://www.binance.com/bapi/ramp/v1/public/ramp/b402";

export const WEB3_API = "https://web3.binance.com";

export const SKILLS_HUB_REPO = "https://github.com/binance/binance-skills-hub";

export const AGENT_NATIVE_DOCS =
  "https://developers.binance.com/en/docs/agent-native/mcp-server/agentic";

/** Major CEX pairs only. Default treasury pair for the ScoutPay loop. */
export const MAJOR_PAIRS = ["BNBUSDT", "BTCUSDT", "ETHUSDT"] as const;
export const DEFAULT_SYMBOL = "BNBUSDT";
export const DEFAULT_SYMBOLS = [DEFAULT_SYMBOL] as const;
export const DEMO_SYMBOLS = DEFAULT_SYMBOLS;

export const KLINE_INTERVAL = "1h";
export const KLINE_LIMIT = 24;
export const DEPTH_LIMIT = 20;

/**
 * BTC model-calibration panel (Track A Data).
 * Screenshot families, not a reverse-engineer of their weights.
 * Event: P(close[t+H] > close[t]) over H future 1h bars; features from L lookback bars.
 */
export const CALIB_SYMBOL = "BTCUSDT";
export const CALIB_INTERVAL = "1h";
export const CALIB_BARS = 2000;
export const CALIB_HORIZONS = [1, 2, 3, 4, 5] as const;
export const CALIB_LOOKBACKS = [1, 2, 3, 4, 5] as const;
export const CALIB_BASELINE_HORIZONS = [4, 5] as const;
/** |bias| below this (and N ≥ CALIB_N_SUFFICIENT) → 基本靠谱. */
export const CALIB_RELIABLE_PT = 3;
/** |bias| below this → 吻合但没优势; ≥ this → 明显高估 / 明显低估. */
export const CALIB_AGREE_PT = 6;
export const CALIB_N_SUFFICIENT = 30;
export const CALIB_CACHE_DIR = ".cache";
export const CALIB_ARTIFACT_DIR = "artifacts";
export const CALIB_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** BSC Testnet — B402 / x402 demo settlement target. Never mainnet money. */
export const B402_TESTNET_CHAIN_ID = 97;
export const B402_TESTNET_CAIP = `eip155:${B402_TESTNET_CHAIN_ID}`;

export const DEMO_COUNTERPARTY_PAY_TO =
  "0x1111111111111111111111111111111111111111";

export const USD1_BSC = "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d";
export const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";
/** Wrapped BNB on BSC — audit/info target for the BNBUSDT Alpha Report. */
export const WBNB_BSC = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

/** In-repo merchant price. Well under the $20/day Agentic Wallet x402 cap. */
export const X402_MAX_USD = 1;
export const MEMO_PRICE_USD = 0.25;
/** 6-decimal USDT atomic units for $0.25. */
export const MEMO_AMOUNT_ATOMIC = "250000";
export const MEMO_DECIMALS = 6;

/**
 * Fallback only. Live min notional must come from exchangeInfo.
 * Observed 5 USDT on BNBUSDT as of 2026-09-01.
 */
export const MIN_NOTIONAL_FALLBACK_USDT = 5;
export const TAKER_FEE_BPS = 10;
export const FEE_BUFFER_USDT = 0.05;
export const EARN_DEPOSIT_MIN_USDT = 1;
export const EARN_DEPOSIT_MAX_USDT = 5;

export const RISK = {
  maxNotionalUsd: 250,
  maxPortfolioPct: 0.05,
  minConfidence: 0.38,
  maxAbsFunding: 0.05,
  fundingWeight: 0.55,
  imbalanceWeight: 0.45,
  fundingScale: 0.0005,
  sideDeadband: 0.05,
  maxLeverage: 1,
} as const;

/** Sample Agentic-sub book for dry-run. Never a main-account snapshot. */
export const SAMPLE_PORTFOLIO = [
  { asset: "USDT", free: "20", locked: "0" },
  { asset: "BNB", free: "0", locked: "0" },
] as const;

export const SKILL_UA = "desk-agent/1.2.0 (Track-A)";
export const WEB3_SKILL_UA = "binance-web3/2.0 (Skill)";
export const WEB3_AUDIT_UA = "binance-web3/1.4 (Skill)";
