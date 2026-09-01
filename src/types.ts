export type Side = "BUY" | "SELL" | "HOLD";

export type Venue = "spot" | "margin" | "convert" | "um-futures" | "cm-futures";

export type DataSource = {
  kind: "rest" | "mcp" | "fixture" | "bazaar" | "skills-hub" | "mock" | "merchant";
  host?: string;
  note?: string;
};

export type Ticker24h = {
  symbol: string;
  lastPrice: number;
  bidPrice: number;
  askPrice: number;
  priceChangePercent: number;
  volume: number;
  quoteVolume: number;
  highPrice: number;
  lowPrice: number;
};

export type DepthBook = {
  symbol: string;
  lastUpdateId: number;
  bids: Array<[price: number, qty: number]>;
  asks: Array<[price: number, qty: number]>;
};

export type Kline = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};

export type FundingPrint = {
  symbol: string;
  markPrice: number;
  indexPrice: number;
  lastFundingRate: number;
  nextFundingTime: number;
};

export type BookLevels = {
  imbalance: number;
  bidQty: number;
  askQty: number;
  mid: number;
  spreadBps: number;
};

export type SupportResistance = {
  support: number;
  resistance: number;
  last: number;
  distToSupportPct: number;
  distToResistancePct: number;
};

export type SpotFilters = {
  symbol: string;
  minNotional: number;
  minQty: number;
  stepSize: number;
  source: DataSource;
};

export type Balance = {
  asset: string;
  free: number;
  locked: number;
};

export type PortfolioInsight = {
  source: DataSource;
  balances: Balance[];
  totalUsd: number;
  usdtFree: number;
  weights: Array<{ asset: string; usd: number; weightPct: number }>;
  estimatedPnl24hUsd: number;
  concentration: string;
  notes: string[];
};

export type MarketRow = {
  symbol: string;
  ticker: Ticker24h;
  book: BookLevels;
  klines: Kline[];
  funding: FundingPrint | null;
  levels: SupportResistance;
  source: DataSource;
};

export type SkillSignal = {
  source: DataSource;
  summary: string;
  stub: boolean;
};

export type TokenInspect = {
  chainId: string;
  contractAddress: string;
  name?: string;
  symbol?: string;
  priceUsd?: number;
  change24hPct?: number;
  liquidityUsd?: number;
  source: DataSource;
};

export type TokenAudit = {
  hasResult: boolean;
  isSupported: boolean;
  riskLevelEnum?: string;
  riskLevel?: number;
  buyTax?: string;
  sellTax?: string;
  hits: string[];
  honeypot: boolean;
  source: DataSource;
};

export type AlphaReport = {
  symbol: string;
  row: MarketRow;
  filters: SpotFilters;
  token: TokenInspect;
  audit: TokenAudit;
  skillSignal: SkillSignal;
  portfolio: PortfolioInsight;
};

export type Signal = {
  symbol: string;
  side: Side;
  confidence: number;
  rationale: string;
  suggestedSize: {
    quoteUsd: number;
    baseQty: number;
    maxNotionalUsd: number;
    cappedBy: string;
  };
  inputs: {
    lastPrice: number;
    fundingRate: number;
    imbalance: number;
    change24hPct: number;
    rawScore: number;
  };
  risk: {
    maxLeverage: number;
    skipped: boolean;
    skipReason?: string;
  };
};

export type TradeIntent = {
  capability: "trade";
  venue: Venue;
  confirmBeforeExecute: true;
  dryRun: boolean;
  order: {
    symbol: string;
    side: Exclude<Side, "HOLD">;
    type: "MARKET";
    quantity?: string;
    quoteOrderQty: string;
  };
};

export type ExecutionResult = {
  mode: "dry-run" | "blocked" | "live-blocked-no-mcp" | "waiting-confirm";
  payload: TradeIntent | Record<string, never>;
  note: string;
};

export type BazaarAccept = {
  scheme: string;
  network: string;
  asset: string;
  maxAmountRequired?: string;
  amount?: string;
  payTo: string;
};

export type BazaarResource = {
  resource: string;
  type?: string;
  x402Version?: number;
  description?: string;
  accepts: BazaarAccept[];
  lastUpdated?: number;
};

export type PaymentRequired = {
  x402Version: 2;
  error: string;
  resource: {
    url: string;
    description: string;
    mimeType: string;
  };
  accepts: Array<{
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra: Record<string, string>;
  }>;
  extensions: Record<string, unknown>;
};

export type PaymentTraceStep = {
  status: number | string;
  title: string;
  detail: string;
  body?: unknown;
};

export type PaymentReceipt = {
  settlement: "mock" | "merchant";
  chainId: number;
  network: string;
  payer: "Desk";
  payee: "Counterparty";
  amount: string;
  amountUsd: number;
  asset: string;
  txHash: string;
  settledAt: string;
  resource: string;
};

export type GatedMemo = {
  title: string;
  body: string;
  symbol: string;
};

export type PaymentRun = {
  rail: "merchant" | "bazaar";
  bazaarSource: DataSource;
  listed: number;
  cheapListings: number;
  picked: BazaarResource | null;
  requirement: PaymentRequired;
  amountUsd: number;
  readyToSign: boolean;
  signatureHeader: string;
  memo: GatedMemo | null;
  trace: PaymentTraceStep[];
  receipt: PaymentReceipt | null;
};

export type DefiIntent = {
  action: "earn-deposit";
  chain: "bsc-testnet";
  chainId: 97;
  dryRun: boolean;
  walletSkillInstalled: boolean;
  amountUsdt: number;
  summary: string;
  bawCommand: string;
  note: string;
};

export type OnchainRun = {
  token: TokenInspect;
  audit: TokenAudit;
  intent: DefiIntent;
  adapters: string[];
};

export type McpStatus = {
  endpoint: string;
  reachable: boolean;
  authenticated: boolean;
  tools: string[];
  capabilities: {
    market: boolean;
    account: boolean;
    trade: boolean;
    transfer: boolean;
  };
  note: string;
};

export type Confirms = {
  pay: boolean;
  spot: boolean;
  defi: boolean;
};

export type ChecklistItem = {
  id: string;
  ok: boolean;
  gate: boolean;
  label: string;
  detail: string;
};

export type Checklist = {
  items: ChecklistItem[];
  hardPass: boolean;
  liveBlocked: boolean;
};

export type DemoReport = {
  generatedAt: string;
  loop: "ScoutPay";
  symbol: string;
  mcp: McpStatus;
  confirms: Confirms;
  checklist: Checklist;
  data: AlphaReport;
  payments: PaymentRun;
  trading: {
    signal: Signal;
    execution: ExecutionResult;
  };
  onchain: OnchainRun;
};
