export const DESK_VERSION = "1.0.0";

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

export const DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"] as const;

export const DEMO_SYMBOLS = DEFAULT_SYMBOLS;

export const KLINE_INTERVAL = "1h";
export const KLINE_LIMIT = 24;
export const DEPTH_LIMIT = 20;

/** BSC Testnet — B402 / x402 demo settlement target. Never mainnet money. */
export const B402_TESTNET_CHAIN_ID = 97;
export const B402_TESTNET_CAIP = `eip155:${B402_TESTNET_CHAIN_ID}`;

/** Obvious mock counterparty on testnet — not a live merchant. */
export const DEMO_COUNTERPARTY_PAY_TO =
  "0x1111111111111111111111111111111111111111";

/** USD1 on BSC (mainnet listing used only as asset metadata; settlement is mocked on 97). */
export const USD1_BSC = "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d";
export const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";

export const RISK = {
  maxNotionalUsd: 250,
  maxPortfolioPct: 0.05,
  minConfidence: 0.38,
  /** Skip if |funding| exceeds this (broken/untradeable print). */
  maxAbsFunding: 0.05,
  fundingWeight: 0.55,
  imbalanceWeight: 0.45,
  /** Funding of this magnitude maps to score ±1. */
  fundingScale: 0.0005,
  sideDeadband: 0.05,
  maxLeverage: 1,
} as const;

export const SAMPLE_PORTFOLIO = [
  { asset: "USDT", free: "10000", locked: "0" },
  { asset: "BTC", free: "0.08", locked: "0" },
  { asset: "ETH", free: "1.5", locked: "0" },
  { asset: "SOL", free: "25", locked: "0" },
] as const;

export const SKILL_UA = "desk-agent/1.0.0 (Track-A)";
export const WEB3_SKILL_UA = "binance-web3/2.0 (Skill)";
export const WEB3_AUDIT_UA = "binance-web3/1.4 (Skill)";
